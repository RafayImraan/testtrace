const request = require('supertest');
const { resetDb, seedUsers, app, pool } = require('./helpers');

describe('Defect traceability', () => {
  let server;
  let projectId;
  let requirementId;
  let testCaseId;
  let leadToken;
  let testerToken;

  beforeAll(async () => {
    await resetDb();
    const seeded = await seedUsers();
    projectId = seeded.projectId;
    requirementId = seeded.requirementId;
    server = app();
    for (const email of ['lead@test.local', 'tester@test.local']) {
      const login = await request(server).post('/api/auth/login').send({ email, password: 'Test@123' });
      if (email.startsWith('lead')) leadToken = login.body.token;
      else testerToken = login.body.token;
    }
    const result = await request(server).post('/api/test-cases')
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ projectId, requirementId, title: 'Checkout failure trace', expectedResult: 'Order completes', module: 'Checkout' });
    testCaseId = result.body.testCase.id;
  });

  afterAll(async () => { await pool.end(); });

  test('tester reports a defect linked to its requirement and test case; lead updates its state', async () => {
    const created = await request(server).post('/api/defects')
      .set('Authorization', `Bearer ${testerToken}`)
      .send({ projectId, requirementId, testCaseId, title: 'Checkout returns server error', description: 'Submit a valid order and observe HTTP 500.', severity: 'critical' });
    expect(created.status).toBe(201);
    expect(created.body.defect.requirementId).toBe(requirementId);
    expect(created.body.defect.testCaseId).toBe(testCaseId);
    expect(created.body.defect.code).toMatch(/^DEF-/);

    const listed = await request(server).get(`/api/defects?projectId=${projectId}`)
      .set('Authorization', `Bearer ${leadToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data[0].requirementCode).toBe('REQ-001');
    expect(listed.body.data[0].testCaseId).toBe(testCaseId);

    const changed = await request(server).patch(`/api/defects/${created.body.defect.id}`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ status: 'fixed' });
    expect(changed.status).toBe(200);
    expect(changed.body.defect.status).toBe('fixed');
    expect(changed.body.defect.resolvedAt).toBeTruthy();
  });

  test('rejects a test case that is not linked to the selected requirement', async () => {
    const otherRequirement = await pool.query(
      "INSERT INTO requirements (project_id, code, title) VALUES ($1, 'REQ-OTHER', 'Other requirement') RETURNING id",
      [projectId]
    );
    const response = await request(server).post('/api/defects')
      .set('Authorization', `Bearer ${testerToken}`)
      .send({ projectId, requirementId: otherRequirement.rows[0].id, testCaseId, title: 'Invalid trace', description: 'This link should be rejected.' });
    expect(response.status).toBe(400);
  });
});
