import request from 'supertest';
import {
  ApiError,
  createTestApp,
  dateOffset,
  login,
  LoggedInUser,
  SEED_ACCOUNTS,
  TestApp,
} from './helpers/test-app';

interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: { name: string };
}

interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  status: string;
  pickupDate: string;
  totalPrice: number;
  items: OrderItem[];
}

describe('Order & aturan booking (e2e)', () => {
  let app: TestApp;
  let admin: LoggedInUser;
  let siti: LoggedInUser;
  let budi: LoggedInUser;
  let productId: string;
  let productPrice: number;

  /** Order yang dibuat selama pengujian, dibersihkan di akhir. */
  const createdOrderIds: string[] = [];

  const auth = (user: LoggedInUser) => ({
    Authorization: `Bearer ${user.token}`,
  });

  /** Membuat order baru milik `user` dan mencatatnya untuk dibersihkan nanti. */
  async function createOrder(user: LoggedInUser, quantity = 2) {
    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set(auth(user))
      .send({
        pickupDate: dateOffset(1),
        items: [{ productId, quantity }],
      })
      .expect(201);

    const order = response.body as Order;
    createdOrderIds.push(order.id);
    return order;
  }

  beforeAll(async () => {
    app = await createTestApp();
    admin = await login(app, SEED_ACCOUNTS.admin);
    siti = await login(app, SEED_ACCOUNTS.siti);
    budi = await login(app, SEED_ACCOUNTS.budi);

    const response = await request(app.getHttpServer())
      .get('/api/products?category=cupcake')
      .expect(200);

    const body = response.body as {
      data: { id: string; price: number }[];
    };
    productId = body.data[0].id;
    productPrice = body.data[0].price;
  });

  afterAll(async () => {
    // Bersihkan order buatan test supaya database kembali seperti hasil seed.
    for (const id of createdOrderIds) {
      await request(app.getHttpServer())
        .delete(`/api/orders/${id}`)
        .set(auth(admin));
    }
    await app.close();
  });

  describe('membuat order', () => {
    it('menerima pesanan untuk besok dan menghitung totalnya sendiri', async () => {
      const order = await createOrder(siti, 3);

      expect(order.status).toBe('PENDING');
      expect(order.orderNumber).toMatch(/^HC-\d{8}-[A-Z0-9]{4}$/);
      expect(order.userId).toBe(siti.id);

      const item = order.items[0];
      expect(item.unitPrice).toBe(productPrice);
      expect(item.subtotal).toBe(productPrice * 3);
      expect(order.totalPrice).toBe(item.subtotal);
    });

    it('memakai id pemesan dari token, bukan dari body', async () => {
      // userId bukan bagian dari DTO, jadi kiriman ini harus ditolak mentah-mentah.
      await request(app.getHttpServer())
        .post('/api/orders')
        .set(auth(siti))
        .send({
          userId: budi.id,
          pickupDate: dateOffset(1),
          items: [{ productId, quantity: 1 }],
        })
        .expect(400);
    });

    it('menolak pesanan untuk hari ini (aturan booking H-1)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .set(auth(siti))
        .send({
          pickupDate: dateOffset(0),
          items: [{ productId, quantity: 1 }],
        })
        .expect(400);

      expect((response.body as ApiError).message).toContain(
        'paling lambat 1 hari sebelum',
      );
    });

    it('menolak pesanan untuk tanggal yang sudah lewat', async () => {
      await request(app.getHttpServer())
        .post('/api/orders')
        .send({
          pickupDate: dateOffset(-1),
          items: [{ productId, quantity: 1 }],
        })
        .set(auth(siti))
        .expect(400);
    });

    it('menolak totalPrice kiriman client', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .set(auth(siti))
        .send({
          pickupDate: dateOffset(1),
          items: [{ productId, quantity: 1 }],
          totalPrice: 1,
        })
        .expect(400);

      expect(JSON.stringify((response.body as ApiError).message)).toContain(
        'totalPrice',
      );
    });

    it('menolak menu yang sama dikirim dua kali', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .set(auth(siti))
        .send({
          pickupDate: dateOffset(1),
          items: [
            { productId, quantity: 1 },
            { productId, quantity: 2 },
          ],
        })
        .expect(400);

      expect((response.body as ApiError).message).toContain(
        'lebih dari sekali',
      );
    });

    it('menolak order tanpa item', async () => {
      await request(app.getHttpServer())
        .post('/api/orders')
        .set(auth(siti))
        .send({ pickupDate: dateOffset(1), items: [] })
        .expect(400);
    });

    it('menolak order tanpa token', async () => {
      await request(app.getHttpServer())
        .post('/api/orders')
        .send({
          pickupDate: dateOffset(1),
          items: [{ productId, quantity: 1 }],
        })
        .expect(401);
    });
  });

  describe('hak akses order', () => {
    it('customer hanya melihat ordernya sendiri di GET /orders', async () => {
      await createOrder(siti);

      const response = await request(app.getHttpServer())
        .get('/api/orders')
        .set(auth(siti))
        .expect(200);

      const body = response.body as { data: Order[] };
      expect(body.data.length).toBeGreaterThan(0);
      body.data.forEach((o) => expect(o.userId).toBe(siti.id));
    });

    it('admin melihat order milik semua customer', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/orders')
        .set(auth(admin))
        .expect(200);

      const body = response.body as { data: Order[] };
      const owners = new Set(body.data.map((o) => o.userId));
      expect(owners.size).toBeGreaterThan(1);
    });

    it('customer tidak bisa membuka order milik customer lain', async () => {
      const order = await createOrder(siti);

      const response = await request(app.getHttpServer())
        .get(`/api/orders/${order.id}`)
        .set(auth(budi))
        .expect(403);

      expect((response.body as ApiError).message).toContain('bukan milikmu');
    });

    it('customer tidak bisa meminta history order orang lain', async () => {
      await request(app.getHttpServer())
        .get(`/api/orders/user/${siti.id}`)
        .set(auth(budi))
        .expect(403);
    });

    it('admin boleh membuka history order siapa pun', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/orders/user/${siti.id}`)
        .set(auth(admin))
        .expect(200);

      const body = response.body as { data: Order[] };
      body.data.forEach((o) => expect(o.userId).toBe(siti.id));
    });
  });

  describe('mengganti waktu pengambilan', () => {
    it('mengizinkan customer memindahkan tanggal ke depan', async () => {
      const order = await createOrder(siti);
      const newDate = dateOffset(7);

      const response = await request(app.getHttpServer())
        .patch(`/api/orders/${order.id}/pickup-date`)
        .set(auth(siti))
        .send({ pickupDate: newDate })
        .expect(200);

      expect((response.body as Order).pickupDate.slice(0, 10)).toBe(newDate);
    });

    it('menolak pindah ke tanggal yang melanggar aturan H-1', async () => {
      const order = await createOrder(siti);

      await request(app.getHttpServer())
        .patch(`/api/orders/${order.id}/pickup-date`)
        .set(auth(siti))
        .send({ pickupDate: dateOffset(0) })
        .expect(400);
    });

    it('menolak customer lain mengubah tanggal', async () => {
      const order = await createOrder(siti);

      await request(app.getHttpServer())
        .patch(`/api/orders/${order.id}/pickup-date`)
        .set(auth(budi))
        .send({ pickupDate: dateOffset(7) })
        .expect(403);
    });
  });

  describe('alur status order', () => {
    it('menolak customer mengubah status', async () => {
      const order = await createOrder(siti);

      await request(app.getHttpServer())
        .patch(`/api/orders/${order.id}/status`)
        .set(auth(siti))
        .send({ status: 'CONFIRMED' })
        .expect(403);
    });

    it('menolak lompat dari PENDING langsung ke READY', async () => {
      const order = await createOrder(siti);

      const response = await request(app.getHttpServer())
        .patch(`/api/orders/${order.id}/status`)
        .set(auth(admin))
        .send({ status: 'READY' })
        .expect(400);

      expect((response.body as ApiError).message).toContain('CONFIRMED');
    });

    it('mengikuti alur PENDING -> CONFIRMED -> READY -> COMPLETED', async () => {
      const order = await createOrder(siti);

      for (const status of ['CONFIRMED', 'READY', 'COMPLETED']) {
        const response = await request(app.getHttpServer())
          .patch(`/api/orders/${order.id}/status`)
          .set(auth(admin))
          .send({ status })
          .expect(200);

        expect((response.body as Order).status).toBe(status);
      }
    });

    it('menolak perubahan setelah status final', async () => {
      const order = await createOrder(siti);

      for (const status of ['CONFIRMED', 'READY', 'COMPLETED']) {
        await request(app.getHttpServer())
          .patch(`/api/orders/${order.id}/status`)
          .set(auth(admin))
          .send({ status })
          .expect(200);
      }

      const response = await request(app.getHttpServer())
        .patch(`/api/orders/${order.id}/status`)
        .set(auth(admin))
        .send({ status: 'PENDING' })
        .expect(400);

      expect((response.body as ApiError).message).toContain('final');
    });

    it('mengizinkan customer membatalkan ordernya sendiri', async () => {
      const order = await createOrder(siti);

      const response = await request(app.getHttpServer())
        .patch(`/api/orders/${order.id}/cancel`)
        .set(auth(siti))
        .expect(200);

      expect((response.body as Order).status).toBe('CANCELLED');
    });

    it('menolak mengubah tanggal order yang sudah dibatalkan', async () => {
      const order = await createOrder(siti);

      await request(app.getHttpServer())
        .patch(`/api/orders/${order.id}/cancel`)
        .set(auth(siti))
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/api/orders/${order.id}/pickup-date`)
        .set(auth(siti))
        .send({ pickupDate: dateOffset(7) })
        .expect(400);

      expect((response.body as ApiError).message).toContain('CANCELLED');
    });
  });

  describe('riwayat order tetap utuh', () => {
    it('menyimpan harga saat order dibuat, bukan harga terbaru', async () => {
      const order = await createOrder(siti, 1);
      const hargaSaatOrder = order.items[0].unitPrice;

      // Admin menaikkan harga menu setelah order masuk.
      await request(app.getHttpServer())
        .patch(`/api/products/${productId}`)
        .set(auth(admin))
        .send({ price: hargaSaatOrder + 50000 })
        .expect(200);

      const reread = await request(app.getHttpServer())
        .get(`/api/orders/${order.id}`)
        .set(auth(siti))
        .expect(200);

      const body = reread.body as Order;
      expect(body.items[0].unitPrice).toBe(hargaSaatOrder);
      expect(body.totalPrice).toBe(hargaSaatOrder);

      // Kembalikan harga menu seperti semula.
      await request(app.getHttpServer())
        .patch(`/api/products/${productId}`)
        .set(auth(admin))
        .send({ price: hargaSaatOrder })
        .expect(200);
    });
  });
});
