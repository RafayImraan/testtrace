/**
 * Runner dispatcher: picks UI or API runner based on script type.
 * Every script lives in /worker/scripts and exports:
 *   module.exports = async ({ page, request, context, sampleAppUrl, backendUrl, run, headless }) => {
 *     return { status: 'PASSED'|'FAILED', log: '...', screenshotPath?: '/uploads/screenshots/...', error?: '...' }
 *   }
 * The runner wraps it with timeout, error handling, screenshot capture.
 */
const path = require('path');
const fs = require('fs');

const SCRIPTS_ROOT = path.resolve(__dirname, '../scripts');

async function executeRun(run, opts = {}) {
  const filePath = path.join(SCRIPTS_ROOT, run.file_path);
  if (!fs.existsSync(filePath)) {
    return {
      status: 'FAILED',
      log: `Script file not found: ${run.file_path}`,
      error: `File not found: ${run.file_path}`,
      durationMs: 0,
    };
  }

  const timeoutMs = run.timeout_ms || 60000;
  const started = Date.now();

  try {
    if (run.script_type === 'api' || run.file_path.startsWith('api/')) {
      const apiRunner = require('./apiRunner');
      const result = await withTimeout(apiRunner.runApiScript(filePath, run, opts), timeoutMs);
      return { ...result, durationMs: result.durationMs || Date.now() - started };
    } else {
      const uiRunner = require('./uiRunner');
      const result = await withTimeout(uiRunner.runUiScript(filePath, run, opts), timeoutMs);
      return { ...result, durationMs: result.durationMs || Date.now() - started };
    }
  } catch (err) {
    const isTimeout = err.message && err.message.includes('timeout');
    return {
      status: 'FAILED',
      log: `Execution ${isTimeout ? 'timeout' : 'error'} after ${Date.now() - started}ms:\n${err.message}\n${err.stack || ''}`.slice(0, 8000),
      error: err.message,
      durationMs: Date.now() - started,
    };
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Script timeout after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

module.exports = { executeRun };
