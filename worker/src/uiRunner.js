/**
 * Playwright UI runner.
 * Launches a browser, creates a page, loads the user script.
 * On failure, takes a screenshot and saves it to the shared uploads volume
 * so the backend can serve it at /uploads/screenshots/<file>.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runUiScript(filePath, run, { headless = true, sampleAppUrl, backendUrl } = {}) {
  const logs = [];
  const log = (msg) => { logs.push(`[${new Date().toISOString()}] ${msg}`); console.log(`[ui:${run.id}] ${msg}`); };

  let browser;
  try {
    log(`Launching browser headless=${headless} for ${run.file_path}`);
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: undefined,
    });
    const page = await context.newPage();

    // Expose log helper to script
    page.on('console', (msg) => log(`PAGE console ${msg.type()}: ${msg.text()}`));

    // Load user script (it exports a function)
    delete require.cache[require.resolve(filePath)];
    const userFn = require(filePath);
    if (typeof userFn !== 'function') throw new Error(`Script ${run.file_path} does not export a function`);

    log(`Executing ${run.file_path} against SUT ${sampleAppUrl} / backend ${backendUrl}`);
    const result = await userFn({ page, context, browser, log, run, sampleAppUrl, backendUrl, headless });

    if (!result || !result.status) throw new Error(`Script ${run.file_path} returned invalid result: ${JSON.stringify(result)}`);

    // If script says FAILED but didn't provide screenshot, take one now
    let screenshotPath = result.screenshotPath || null;
    if (result.status === 'FAILED' && !screenshotPath) {
      try {
        screenshotPath = await takeScreenshot(page, run);
        log(`Screenshot saved: ${screenshotPath}`);
      } catch (e) {
        log(`Failed to take screenshot: ${e.message}`);
      }
    }

    await browser.close();
    return {
      status: result.status,
      log: (result.log ? result.log + '\n' : '') + logs.join('\n'),
      error: result.error || (result.status === 'FAILED' ? 'UI assertion failed' : null),
      screenshotPath,
      durationMs: result.durationMs,
    };
  } catch (err) {
    // On any exception, try to screenshot
    let screenshotPath = null;
    try {
      if (browser) {
        const pages = browser.contexts()[0]?.pages() || [];
        if (pages[0]) screenshotPath = await takeScreenshot(pages[0], run);
      }
    } catch (_) {}
    try { if (browser) await browser.close(); } catch (_) {}

    return {
      status: 'FAILED',
      log: logs.join('\n') + `\n\nEXCEPTION: ${err.message}\n${err.stack || ''}`.slice(0, 8000),
      error: err.message,
      screenshotPath,
    };
  }
}

async function takeScreenshot(page, run) {
  const fileName = `run-${run.id}-${Date.now()}.png`;
  // Try shared volume first (docker), fallback to local artifacts
  const candidates = [
    path.resolve('/app/uploads/screenshots', fileName),
    path.resolve('/app/backend/uploads/screenshots', fileName),
    path.resolve(__dirname, '../../backend/uploads/screenshots', fileName),
    path.resolve(__dirname, '../.artifacts/screenshots', fileName),
  ];
  let saved = null;
  for (const p of candidates) {
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      await page.screenshot({ path: p, fullPage: true });
      saved = p;
      break;
    } catch (_) { continue; }
  }
  if (!saved) return null;
  // Return path as served by backend (/uploads/screenshots/...)
  return `/uploads/screenshots/${fileName}`;
}

module.exports = { runUiScript };
