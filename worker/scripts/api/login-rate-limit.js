/**
 * API: Login rate limit - should return 429 after many attempts
 * This tests the backend's own rate limiting (self-test)
 */
module.exports = async ({ log, backendUrl, request }) => {
  const base = backendUrl || 'http://localhost:4000';
  const url = `${base}/api/auth/login`;
  log(`Testing rate limit at ${url}`);
  // Use a reserved test-only client address so this check cannot rate-limit
  // the worker's real connection and interfere with other scripts in a batch.
  const testClientIp = `198.51.100.${(Number(run.id) % 254) + 1}`;
  let lastStatus = null;
  let got429 = false;
  // Try 12 quick failed logins (limit is 10 per 15min)
  for (let i = 0; i < 12; i++) {
    try {
      const res = await request.post(url, {
        headers: { 'X-Forwarded-For': testClientIp },
        data: { email: 'brute@tta.local', password: 'wrong' },
      });
      lastStatus = res.status();
      log(`Attempt ${i+1}: status ${res.status()}`);
      if (res.status() === 429) { got429 = true; break; }
    } catch (e) {
      log(`Attempt ${i+1} error: ${e.message}`);
    }
  }
  if (got429) {
    return { status: 'PASSED', log: `Rate limiting works: got 429 after attempts, lastStatus=${lastStatus}` };
  }
  return { status: 'FAILED', log: `Rate limit did not return 429; lastStatus=${lastStatus}`, error: 'Login rate limit was not enforced' };
};
