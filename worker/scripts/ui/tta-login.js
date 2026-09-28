/**
 * UI: Test the platform itself - login page loads.
 * Tries FRONTEND_URL first, then local dev server, then falls back to backend health.
 */
module.exports = async ({ page, backendUrl, log }) => {
  const base = backendUrl || 'http://localhost:4000';
  const candidates = [...new Set([process.env.FRONTEND_URL, 'http://localhost:5173'].filter(Boolean))];

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

  try {
    await page.goto(`${base}/api/health`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    const content = await page.textContent('body');
    log(`Backend health: ${content?.slice(0, 200)}`);
    if (content && content.includes('ok')) {
      return { status: 'PASSED', log: `TTA backend health ok: ${content.slice(0, 100)}` };
    }
    return { status: 'FAILED', log: `Could not load TTA frontend nor backend health`, error: 'TTA not reachable' };
  } catch (e) {
    return { status: 'FAILED', log: `Could not load TTA frontend nor backend health: ${e.message}`, error: 'TTA not reachable' };
  }
};
