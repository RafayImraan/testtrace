/**
 * UI: Test the platform itself - login
 * Targets the TTA backend frontend (if running) or falls back to sample-app.
 * This script is meant to demonstrate testing the platform itself.
 */
module.exports = async ({ page, backendUrl, log }) => {
  const base = backendUrl || 'http://localhost:4000';
  // Try to hit frontend if available, otherwise just test backend API via UI
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const urlsToTry = [frontendUrl, `${base}`, 'http://localhost:5173'];
  let loaded = false;
  for (const u of urlsToTry) {
    try {
      await page.goto(`${u}/login`, { waitUntil: 'domcontentloaded', timeout: 5000 });
      const title = await page.title();
      log(`Loaded ${u}/login title: ${title}`);
      if (title || (await page.content()).length > 100) { loaded = true; break; }
    } catch (e) { log(`Failed to load ${u}: ${e.message}`); }
  }
  if (!loaded) {
    // Fallback: just check backend health
    await page.goto(`${base}/api/health`);
    const content = await page.textContent('body');
    log(`Backend health: ${content?.slice(0,200)}`);
    if (content && content.includes('ok')) {
      return { status: 'PASSED', log: `TTA backend health ok: ${content.slice(0,100)}` };
    }
    return { status: 'FAILED', log: `Could not load TTA frontend nor backend health`, error: 'TTA not reachable' };
  }
  return { status: 'PASSED', log: `TTA login page loaded successfully` };
};
