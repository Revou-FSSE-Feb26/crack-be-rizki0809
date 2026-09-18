import request from 'supertest';
import {
  ApiError,
  createTestApp,
  login,
  SEED_ACCOUNTS,
  TestApp,
} from './helpers/test-app';

interface Category {
  id: string;
  slug: string;
  _count: { products: number };
}

interface Product {
  id: string;
  name: string;
  price: number;
  bestSeller: boolean;
  category: { slug: string };
}

describe('Katalog & hak akses (e2e)', () => {
  let app: TestApp;
  let adminToken: string;
  let customerToken: string;
  let pastryCategoryId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await login(app, SEED_ACCOUNTS.admin)).token;
    customerToken = (await login(app, SEED_ACCOUNTS.siti)).token;

    const response = await request(app.getHttpServer())
      .get('/api/categories')
      .expect(200);

    const categories = response.body as Category[];
    pastryCategoryId = categories.find((c) => c.slug === 'pastry')!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('endpoint publik', () => {
    it('katalog menu bisa dibaca tanpa login', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products')
        .expect(200);

      const body = response.body as {
        data: Product[];
        meta: { total: number };
      };
      expect(body.meta.total).toBeGreaterThan(0);
    });

    it('daftar kategori bisa dibaca tanpa login', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/categories')
        .expect(200);

      expect(response.body).toHaveLength(4);
    });

    it('filter kategori hanya mengembalikan menu kategori itu', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products?category=cupcake')
        .expect(200);

      const body = response.body as { data: Product[] };
      expect(body.data.length).toBeGreaterThan(0);
      body.data.forEach((p) => expect(p.category.slug).toBe('cupcake'));
    });

    it('filter bestSeller hanya mengembalikan menu favorit', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products?bestSeller=true')
        .expect(200);

      const body = response.body as { data: Product[] };
      expect(body.data.length).toBeGreaterThan(0);
      body.data.forEach((p) => expect(p.bestSeller).toBe(true));
    });
  });

  describe('endpoint khusus admin', () => {
    const newProduct = {
      name: 'Donat Gula E2E',
      description: 'Donat empuk bertabur gula halus.',
      price: 15000,
      emoji: '\u{1F369}',
      tone: 'bg-cream-300',
    };

    it('menolak tambah menu tanpa token', async () => {
      await request(app.getHttpServer())
        .post('/api/products')
        .send({ ...newProduct, categoryId: pastryCategoryId })
        .expect(401);
    });

    it('menolak tambah menu oleh customer', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ ...newProduct, categoryId: pastryCategoryId })
        .expect(403);

      expect((response.body as ApiError).message).toContain('ADMIN');
    });

    it('mengizinkan admin membuat, mengubah, lalu menghapus menu', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...newProduct, categoryId: pastryCategoryId })
        .expect(201);

      const product = created.body as Product;
      expect(product.category.slug).toBe('pastry');

      const updated = await request(app.getHttpServer())
        .patch(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 18000 })
        .expect(200);

      expect((updated.body as Product).price).toBe(18000);

      await request(app.getHttpServer())
        .delete(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Menu ini belum pernah dipesan, jadi benar-benar hilang.
      await request(app.getHttpServer())
        .get(`/api/products/${product.id}`)
        .expect(404);
    });

    it('menolak harga menu yang tidak masuk akal', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...newProduct, price: -5, categoryId: pastryCategoryId })
        .expect(400);

      expect(JSON.stringify((response.body as ApiError).message)).toContain(
        'price',
      );
    });

    it('menolak menu yang menunjuk kategori tidak ada', async () => {
      await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...newProduct,
          categoryId: '00000000-0000-4000-8000-000000000000',
        })
        .expect(400);
    });

    it('menolak menghapus kategori yang masih berisi menu', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/categories/${pastryCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      expect((response.body as ApiError).message).toContain('masih dipakai');
    });
  });

  describe('daftar user', () => {
    it('hanya bisa dibuka admin', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('tidak pernah membocorkan password', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(JSON.stringify(response.body)).not.toContain('password');
    });
  });
});
