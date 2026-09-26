/**
 * API runner: executes plain Node.js scripts that use fetch/axios to test REST APIs.
 * No browser needed, fast and lightweight.
 */
const path = require('path');
const axios = require('axios');

async function runApiScript(filePath, run, { sampleAppUrl, backendUrl } = {}) {
  const logs = [];
  const log = (msg) => { logs.push(`[${new Date().toISOString()}] ${msg}`); console.log(`[api:${run.id}] ${msg}`); };

  try {
    delete require.cache[require.resolve(filePath)];
    const userFn = require(filePath);
    if (typeof userFn !== 'function') throw new Error(`Script ${run.file_path} does not export a function`);

    log(`Executing API script ${run.file_path} (SUT ${sampleAppUrl}, backend ${backendUrl})`);
    const result = await userFn({ log, run, sampleAppUrl, backendUrl, axios });

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
  }
}

module.exports = { runApiScript };
