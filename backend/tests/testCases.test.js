const request = require('supertest');
const { resetDb, seedUsers, app } = require('./helpers');

describe('Test Cases CRUD + status + audit + assignment + automation ingestion', () => {
  let server;
  let tokens = {};
  let projectId;
  let requirementId;
  let testCaseId;
  let cycleId;
  let cycleTestId;

  beforeAll(async () => {
    await resetDb();
    const seeded = await seedUsers();
    projectId = seeded.projectId;
    requirementId = seeded.requirementId;
    server = app();

    for (const email of ['admin@test.local','lead@test.local','tester@test.local']) {
      const res = await request(server).post('/api/auth/login').send({ email, password: 'Test@123' });
      tokens[email.split('@')[0]] = res.body.token;
    }
  });

  afterAll(async () => {
    const { pool } = require('./helpers');
    await pool.end();
  });

  test('lead can create test case', async () => {
    const res = await request(server).post('/api/test-cases').set('Authorization', `Bearer ${tokens.lead}`).send({
      projectId, title: 'Sample TC', expectedResult: 'Should work', module: 'Login', priority: 'high', requirementId, steps: [{ action: 'Open login' }, { action: 'Enter creds' }]
    });
    expect(res.status).toBe(201);
    expect(res.body.testCase.code).toMatch(/^TC-/);
    testCaseId = res.body.testCase.id;
  });

  test('validation fails without title', async () => {
    const res = await request(server).post('/api/test-cases').set('Authorization', `Bearer ${tokens.lead}`).send({
      projectId, expectedResult: 'x', module: 'Login'
    });
    expect(res.status).toBe(422);
  });

  test('list test cases with filters', async () => {
    const res = await request(server).get(`/api/test-cases?projectId=${projectId}&module=Login`).set('Authorization', `Bearer ${tokens.lead}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('create cycle and add test case', async () => {
    const cRes = await request(server).post('/api/cycles').set('Authorization', `Bearer ${tokens.lead}`).send({ projectId, name: 'Cycle 1', description: 'Test' });
    expect(cRes.status).toBe(201);
    cycleId = cRes.body.cycle.id;

    const add = await request(server).post(`/api/cycles/${cycleId}/tests`).set('Authorization', `Bearer ${tokens.lead}`).send({ testCaseIds: [testCaseId] });
    expect(add.status).toBe(201);
    expect(add.body.added).toBe(1);

    const detail = await request(server).get(`/api/cycles/${cycleId}`).set('Authorization', `Bearer ${tokens.lead}`);
    expect(detail.body.tests.length).toBe(1);
    cycleTestId = detail.body.tests[0].id;
  });

  test('lead can assign test to tester', async () => {
    const testerList = await request(server).get('/api/users/assignable').set('Authorization', `Bearer ${tokens.lead}`);
    const tester = testerList.body.data.find(u=>u.role==='tester');
    const res = await request(server).post(`/api/cycles/${cycleId}/assign`).set('Authorization', `Bearer ${tokens.lead}`).send({ cycleTestIds: [cycleTestId], assigneeId: tester.id, dueDate: '2026-12-31' });
    expect(res.status).toBe(200);
    expect(res.body.assigned).toBe(1);
  });

  test('tester can update own assigned test status and audit log is created', async () => {
    const res = await request(server).patch(`/api/cycle-tests/${cycleTestId}/status`).set('Authorization', `Bearer ${tokens.tester}`).send({ status: 'passed', actualResult: 'Works', remarks: 'OK' });
    expect(res.status).toBe(200);
    expect(res.body.cycleTest.status).toBe('passed');

    const audit = await request(server).get('/api/audit-logs?entityType=cycle_test').set('Authorization', `Bearer ${tokens.lead}`);
    expect(audit.status).toBe(200);
    const found = audit.body.data.find(a=>a.entity_id===cycleTestId && a.action==='status_change');
    expect(found).toBeDefined();
  });

  test('tester cannot update unassigned test (RBAC)', async () => {
    // create second test case and cycle_test unassigned
    const tc = await request(server).post('/api/test-cases').set('Authorization', `Bearer ${tokens.lead}`).send({ projectId, title: 'Unassigned TC', expectedResult: 'Should fail', module: 'Login' });
    expect(tc.status).toBe(201);
    const tcId = tc.body.testCase.id;
    await request(server).post(`/api/cycles/${cycleId}/tests`).set('Authorization', `Bearer ${tokens.lead}`).send({ testCaseIds: [tcId] });
    const detail = await request(server).get(`/api/cycles/${cycleId}`).set('Authorization', `Bearer ${tokens.lead}`);
    const unassigned = detail.body.tests.find(t=>t.test_case_id===tcId);
    expect(unassigned).toBeDefined();
    const res = await request(server).patch(`/api/cycle-tests/${unassigned.id}/status`).set('Authorization', `Bearer ${tokens.tester}`).send({ status: 'failed' });
    expect(res.status).toBe(403);
  });

  test('automation: register script, trigger run, claim and ingest result', async () => {
    // register script
    const script = await request(server).post('/api/automation/scripts').set('Authorization', `Bearer ${tokens.lead}`).send({
      testCaseId, name: 'UI: Login valid', type: 'ui', filePath: 'ui/login-valid.js', description: 'Test script'
    });
    expect(script.status).toBe(201);

    // trigger run for cycle
    const trigger = await request(server).post('/api/automation/run').set('Authorization', `Bearer ${tokens.lead}`).send({ cycleId });
    expect(trigger.status).toBe(202);
    expect(trigger.body.queued).toBeGreaterThanOrEqual(1);

    // claim as worker (lead token is allowed to claim)
    const claim = await request(server).post('/api/automation/claim').set('Authorization', `Bearer ${tokens.lead}`).send({ limit: 2, workerId: 'test-worker' });
    expect(claim.status).toBe(200);
    expect(claim.body.count).toBeGreaterThanOrEqual(1);
    const runId = claim.body.runs[0].id;

    // ingest result
    const ingest = await request(server).post(`/api/automation/runs/${runId}/result`).set('Authorization', `Bearer ${tokens.lead}`).send({
      status: 'PASSED', log: 'All steps passed', durationMs: 1234
    });
    expect(ingest.status).toBe(200);

    // check cycle_test status updated to passed
    const ct = await request(server).get(`/api/cycles/${cycleId}`).set('Authorization', `Bearer ${tokens.lead}`);
    const updated = ct.body.tests.find(t=>t.id===cycleTestId);
    expect(updated.status).toBe('passed');
  });

  test('dashboard stats returns expected shape', async () => {
    const res = await request(server).get(`/api/dashboard/stats?projectId=${projectId}`).set('Authorization', `Bearer ${tokens.lead}`);
    expect(res.status).toBe(200);
    expect(res.body.cards).toBeDefined();
    expect(res.body.status).toBeDefined();
    expect(res.body.perModule).toBeDefined();
  });

  test('reports PDF and Excel endpoints return files', async () => {
    const pdf = await request(server).get(`/api/reports/cycle/${cycleId}.pdf`).set('Authorization', `Bearer ${tokens.lead}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/pdf/);

    const xlsx = await request(server).get(`/api/reports/cycle/${cycleId}.xlsx`).set('Authorization', `Bearer ${tokens.lead}`);
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers['content-type']).toMatch(/sheet/);
  });
});
