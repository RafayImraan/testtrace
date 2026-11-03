/** Playwright API-assisted self-test: create and clean up a real TTA test case. */
module.exports = async ({ page, request, backendUrl, log, run }) => {
  const base = backendUrl || 'http://localhost:4000';
  await page.goto(`${base}/api/health`);
  const health = await page.textContent('body');
  if (!health?.includes('ok')) throw new Error('TTA backend health check failed');

  const login = await request.post(`${base}/api/auth/login`, { data: { email: 'lead@tta.local', password: 'Lead@123' } });
  const auth = await login.json();
  if (!login.ok() || !auth.token) throw new Error(`Lead login failed with ${login.status()}`);
  const headers = { Authorization: `Bearer ${auth.token}` };
  const created = await request.post(`${base}/api/test-cases`, {
    headers,
    data: {
      projectId: Number(process.env.TEST_PROJECT_ID || 1),
      title: `Playwright self-test ${run.id}`,
      expectedResult: 'The test case is created by the platform API.',
      module: 'Automation',
      priority: 'low',
    },
  });
  const body = await created.json();
  const testCaseId = body.testCase?.id;
  if (!created.ok() || !testCaseId) throw new Error(`Test case creation failed: ${created.status()} ${JSON.stringify(body)}`);
  log(`Created ${body.testCase.code} through the TTA API`);

  const deleted = await request.delete(`${base}/api/test-cases/${testCaseId}`, { headers });
  if (!deleted.ok()) throw new Error(`Temporary test case cleanup failed: ${deleted.status()}`);
  return { status: 'PASSED', log: `TTA self-test created and removed ${body.testCase.code}` };
};
