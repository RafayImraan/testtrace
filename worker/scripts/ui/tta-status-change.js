/** Playwright API-assisted end-to-end check of assignment and tester status update. */
module.exports = async ({ page, request, backendUrl, log, run }) => {
  const base = backendUrl || 'http://localhost:4000';
  await page.goto(`${base}/api/health`);
  const health = await page.textContent('body');
  if (!health?.includes('ok')) throw new Error('TTA backend health check failed');

  const leadLogin = await request.post(`${base}/api/auth/login`, { data: { email: 'lead@tta.local', password: 'Lead@123' } });
  const lead = await leadLogin.json();
  if (!leadLogin.ok() || !lead.token) throw new Error(`Lead login failed: ${leadLogin.status()}`);
  const headers = { Authorization: `Bearer ${lead.token}` };
  const projectId = Number(process.env.TEST_PROJECT_ID || 1);
  let testCaseId;
  let cycleId;

  try {
    const tcResponse = await request.post(`${base}/api/test-cases`, { headers, data: {
      projectId,
      title: `Playwright status self-test ${run.id}`,
      expectedResult: 'The assigned tester can change the cycle test status.',
      module: 'Automation',
      priority: 'low',
    } });
    const tcBody = await tcResponse.json();
    testCaseId = tcBody.testCase?.id;
    if (!tcResponse.ok() || !testCaseId) throw new Error(`Test fixture creation failed: ${tcResponse.status()}`);

    const cycleResponse = await request.post(`${base}/api/cycles`, { headers, data: {
      projectId, name: `Playwright status ${run.id}`,
    } });
    const cycleBody = await cycleResponse.json();
    cycleId = cycleBody.cycle?.id;
    if (!cycleResponse.ok() || !cycleId) throw new Error(`Cycle fixture creation failed: ${cycleResponse.status()}`);

    const addResponse = await request.post(`${base}/api/cycles/${cycleId}/tests`, { headers, data: { testCaseIds: [testCaseId] } });
    if (!addResponse.ok()) throw new Error(`Could not add fixture to cycle: ${addResponse.status()}`);
    const detailResponse = await request.get(`${base}/api/cycles/${cycleId}`, { headers });
    const detail = await detailResponse.json();
    const cycleTestId = detail.tests?.[0]?.id;
    if (!cycleTestId) throw new Error('Cycle test fixture was not created');

    const usersResponse = await request.get(`${base}/api/users/assignable`, { headers });
    const users = await usersResponse.json();
    const tester = users.data?.find((user) => user.email === 'tester1@tta.local');
    if (!tester) throw new Error('No active tester account found');
    const assignResponse = await request.post(`${base}/api/cycles/${cycleId}/assign`, { headers, data: {
      cycleTestIds: [cycleTestId], assigneeId: tester.id,
    } });
    if (!assignResponse.ok()) throw new Error(`Could not assign fixture: ${assignResponse.status()}`);

    const testerLogin = await request.post(`${base}/api/auth/login`, { data: { email: 'tester1@tta.local', password: 'Tester@123' } });
    const testerBody = await testerLogin.json();
    if (!testerLogin.ok() || !testerBody.token) throw new Error(`Tester login failed: ${testerLogin.status()}`);
    const updateResponse = await request.patch(`${base}/api/cycle-tests/${cycleTestId}/status`, {
      headers: { Authorization: `Bearer ${testerBody.token}` },
      data: { status: 'in_progress', remarks: 'Updated by Playwright automation self-test' },
    });
    const updated = await updateResponse.json();
    if (!updateResponse.ok() || updated.cycleTest?.status !== 'in_progress') throw new Error(`Status update failed: ${updateResponse.status()}`);
    log(`Tester changed assigned cycle test ${cycleTestId} to in_progress`);
    return { status: 'PASSED', log: `Assignment and status workflow passed for ${tcBody.testCase.code}` };
  } finally {
    if (cycleId) await request.delete(`${base}/api/cycles/${cycleId}`, { headers }).catch(() => {});
    if (testCaseId) await request.delete(`${base}/api/test-cases/${testCaseId}`, { headers }).catch(() => {});
  }
};
