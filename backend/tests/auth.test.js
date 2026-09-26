const request = require('supertest');
const { resetDb, seedUsers, app } = require('./helpers');

describe('Auth & RBAC', () => {
  let server;
  let users;
  let projectId;

  beforeAll(async () => {
    await resetDb();
    const seeded = await seedUsers();
    users = seeded.users;
    projectId = seeded.projectId;
    server = app();
  });

  afterAll(async () => {
    const { pool } = require('./helpers');
    await pool.end();
  });

  test('login with valid credentials returns token', async () => {
    const res = await request(server).post('/api/auth/login').send({ email: 'admin@test.local', password: 'Test@123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
  });

  test('login with invalid password returns 401', async () => {
    const res = await request(server).post('/api/auth/login').send({ email: 'admin@test.local', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('protected route without token returns 401', async () => {
    const res = await request(server).get('/api/users');
    expect(res.status).toBe(401);
  });

  test('tester cannot list users (RBAC 403)', async () => {
    const login = await request(server).post('/api/auth/login').send({ email: 'tester@test.local', password: 'Test@123' });
    const token = login.body.token;
    const res = await request(server).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('admin can list users', async () => {
    const login = await request(server).post('/api/auth/login').send({ email: 'admin@test.local', password: 'Test@123' });
    const token = login.body.token;
    const res = await request(server).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  test('lead can list assignable users but not create user', async () => {
    const login = await request(server).post('/api/auth/login').send({ email: 'lead@test.local', password: 'Test@123' });
    const token = login.body.token;
    const list = await request(server).get('/api/users/assignable').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    const create = await request(server).post('/api/users').set('Authorization', `Bearer ${token}`).send({ email: 'new@test.local', password: 'Test@123', fullName: 'New', role: 'tester' });
    expect(create.status).toBe(403);
  });
});
