/**
 * UI: Test the platform itself - login page loads.
 * Verifies that the platform frontend's login page is reachable.
 */
module.exports = async ({ page, frontendUrl, log }) => {
  const candidates = [...new Set([frontendUrl, process.env.FRONTEND_URL, 'http://localhost:5173'].filter(Boolean))];

  for (const u of candidates) {
    try {
      await page.goto(`${u}/login`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const title = await page.title();
      log(`Loaded ${u}/login title: ${title}`);
      if (title && !(await page.content()).includes('Cannot GET')) {
        return { status: 'PASSED', log: `TTA login page loaded successfully (${u}, title: ${title})` };
      }
    } catch (e) {
      log(`Failed to load ${u}: ${e.message}`);
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
  }

  return { status: 'FAILED', log: 'Could not load the TTA login page from any configured frontend URL', error: 'TTA frontend not reachable' };
};
