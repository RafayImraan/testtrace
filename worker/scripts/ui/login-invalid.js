/**
 * UI: Login with invalid password should show error
 */
module.exports = async ({ page, sampleAppUrl, log }) => {
  const base = sampleAppUrl || 'http://localhost:5000';
  await page.goto(`${base}/login`);
  await page.fill('#loginEmail', 'user@shop.local');
  await page.fill('#loginPass', 'WrongPass123');
  await page.click('#loginBtn');
  await page.waitForTimeout(800);
  const msg = await page.textContent('#loginMsg');
  log(`Invalid login msg: ${msg}`);
  if (msg && msg.toLowerCase().includes('invalid')) {
    return { status: 'PASSED', log: `Invalid login correctly rejected: ${msg}` };
  }
  return { status: 'FAILED', log: `Expected invalid credentials error, got: ${msg}`, error: 'Did not show invalid credentials error' };
};
