import request from 'supertest';
import { createTestApp, TestApp } from './helpers/test-app';

describe('AppController (e2e)', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api mengembalikan status ok tanpa perlu token', async () => {
    const response = await request(app.getHttpServer()).get('/api').expect(200);

    const body = response.body as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('Hadish Cake API');
  });
});
