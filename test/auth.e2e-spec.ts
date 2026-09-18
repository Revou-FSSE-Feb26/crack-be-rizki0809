import request from 'supertest';
import {
  ApiError,
  createTestApp,
  login,
  SEED_ACCOUNTS,
  TestApp,
} from './helpers/test-app';

describe('Auth (e2e)', () => {
  let app: TestApp;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await login(app, SEED_ACCOUNTS.admin)).token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('mendaftarkan customer baru dan langsung memberi token', async () => {
      const email = `e2e-${Date.now()}@example.com`;

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ name: 'Tester E2E', email, password: 'Rahasia123' })
        .expect(201);

      const body = response.body as {
        accessToken: string;
        tokenType: string;
        user: { email: string; role: string };
      };

      expect(body.accessToken.split('.')).toHaveLength(3);
      expect(body.tokenType).toBe('Bearer');
      expect(body.user.email).toBe(email);
      expect(body.user.role).toBe('CUSTOMER');
      expect(JSON.stringify(body)).not.toContain('password');
    });

    it('menolak email yang sudah terdaftar', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Duplikat',
          email: SEED_ACCOUNTS.siti.email,
          password: 'Rahasia123',
        })
        .expect(409);
    });

    it('menolak usaha mendaftar sebagai ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Penyusup',
          email: `penyusup-${Date.now()}@example.com`,
          password: 'Rahasia123',
          role: 'ADMIN',
        })
        .expect(400);

      expect(JSON.stringify((response.body as ApiError).message)).toContain(
        'role',
      );
    });

    it('menolak password di bawah 8 karakter', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Pendek',
          email: `pendek-${Date.now()}@example.com`,
          password: '123',
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('menerbitkan token yang memuat id dan role', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(SEED_ACCOUNTS.admin)
        .expect(200);

      const body = response.body as {
        accessToken: string;
        user: { id: string; role: string };
      };

      const payload = JSON.parse(
        Buffer.from(body.accessToken.split('.')[1], 'base64').toString(),
      ) as { sub: string; role: string; exp: number; iat: number };

      expect(payload.sub).toBe(body.user.id);
      expect(payload.role).toBe('ADMIN');
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('memberi pesan yang sama untuk password salah dan email tak terdaftar', async () => {
      const wrongPassword = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: SEED_ACCOUNTS.admin.email, password: 'SalahBanget' })
        .expect(401);

      const unknownEmail = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'tidakada@example.com', password: 'SalahBanget' })
        .expect(401);

      const message = (wrongPassword.body as ApiError).message;
      expect(message).toBe('Email atau password salah');
      expect((unknownEmail.body as ApiError).message).toBe(message);
    });
  });

  describe('GET /api/auth/me', () => {
    it('mengembalikan akun yang sedang login', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as { email: string };
      expect(body.email).toBe(SEED_ACCOUNTS.admin.email);
      expect(body).not.toHaveProperty('password');
    });

    it('menolak request tanpa token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('menolak token yang tanda tangannya dipalsukan', async () => {
      const tampered = `${adminToken.split('.').slice(0, 2).join('.')}.palsu`;

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tampered}`)
        .expect(401);
    });
  });

  describe('bentuk response error', () => {
    it('selalu memuat statusCode, error, message, path, dan timestamp', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);

      const body = response.body as ApiError;
      expect(body.statusCode).toBe(401);
      expect(body.error).toBeDefined();
      expect(body.message).toBeDefined();
      expect(body.path).toBe('/api/auth/me');
      expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
    });
  });
});
