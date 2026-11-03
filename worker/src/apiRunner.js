/**
 * API runner: executes API checks through Playwright's APIRequestContext.
 */
const { request: playwrightRequest } = require('playwright');

async function runApiScript(filePath, run, { sampleAppUrl, backendUrl } = {}) {
  const logs = [];
  const log = (msg) => { logs.push(`[${new Date().toISOString()}] ${msg}`); console.log(`[api:${run.id}] ${msg}`); };
  const api = await playwrightRequest.newContext({ timeout: run.timeout_ms || 60000 });

  try {
    delete require.cache[require.resolve(filePath)];
    const userFn = require(filePath);
    if (typeof userFn !== 'function') throw new Error(`Script ${run.file_path} does not export a function`);

    log(`Executing API script ${run.file_path} (SUT ${sampleAppUrl}, backend ${backendUrl})`);
    const result = await userFn({ log, run, sampleAppUrl, backendUrl, request: api });

    if (!result || !result.status) throw new Error(`Script returned invalid result: ${JSON.stringify(result)}`);

    return {
      status: result.status,
      log: (result.log ? result.log + '\n' : '') + logs.join('\n'),
      error: result.error || null,
      screenshotPath: null,
      durationMs: result.durationMs,
    };
  } catch (err) {
    return {
      status: 'FAILED',
      log: logs.join('\n') + `\n\nEXCEPTION: ${err.message}\n${err.stack || ''}`.slice(0, 8000),
      error: err.message,
    };
  } finally {
    await api.dispose();
  }
}

module.exports = { runApiScript };
