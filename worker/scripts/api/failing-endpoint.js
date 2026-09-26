/**
 * API: Intentional failure - tests failure handling and screenshot logic
 * Calls checkout with coupon=FAIL which triggers 500 in sample-app when BUG_MODE=true
 */
module.exports = async ({ log, sampleAppUrl, axios }) => {
  const base = sampleAppUrl || 'http://localhost:5000';
  try {
    const res = await axios.post(`${base}/api/checkout`, {
      items: [{ productId: 1, qty: 1, price: 10 }],
      address: '123 Test St',
      coupon: 'FAIL'
    }, { validateStatus: () => true });
    log(`Failing endpoint response status=${res.status} body=${JSON.stringify(res.data).slice(0,300)}`);
    if (res.status === 500) {
      // We expected failure, but for this test we want to demonstrate failure handling
      // So we intentionally mark it as FAILED to show the UI's failure handling
      return { status: 'FAILED', log: `Intentional failure triggered: got 500 as expected (bug demo). Body: ${JSON.stringify(res.data)}`, error: 'Intentional failure: checkout 500 with FAIL coupon' };
    }
    if (res.status === 400) {
      // If BUG_MODE is off, it returns 400 Invalid coupon, not 500
      return { status: 'FAILED', log: `Got 400 instead of 500 (BUG_MODE may be off): ${JSON.stringify(res.data)}`, error: 'Expected 500 but got 400' };
    }
    return { status: 'FAILED', log: `Expected failure but got status ${res.status}`, error: `Unexpected status ${res.status}` };
  } catch (e) {
    log(`Failing endpoint exception: ${e.message}`);
    return { status: 'FAILED', log: `Exception: ${e.message}`, error: e.message };
  }
};
