/**
 * UI: Login with valid credentials (sample-app SUT)
 * Expected: should login and see success or token
 */
module.exports = async ({ page, sampleAppUrl, log }) => {
  const base = sampleAppUrl || 'http://localhost:5000';
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  await page.click('nav >> text=Login');
  await page.waitForSelector('#loginEmail', { state: 'visible' });
  await page.fill('#loginEmail', 'user@shop.local');
  await page.fill('#loginPass', 'User@123');
  await page.click('#loginBtn');
  await page
    .waitForFunction(() => (document.getElementById('loginMsg')?.textContent || '').trim().length > 0, { timeout: 5000 })
    .catch(() => {});
  const msg = await page.textContent('#loginMsg');
  log(`Login message: ${msg}`);
  if (msg && msg.toLowerCase().includes('logged in')) {
    return { status: 'PASSED', log: `Login valid passed: ${msg}` };
  }
  throw new Error(`Login valid failed, message was: ${msg}`);
};
