/**
 * API: Checkout API valid flow (sample-app)
 */
module.exports = async ({ log, sampleAppUrl, request }) => {
  const base = sampleAppUrl || 'http://localhost:5000';
  try {
    const res = await request.post(`${base}/api/checkout`, { data: {
      items: [{ productId: 1, qty: 2, price: 25.99 }],
      address: '123 Test St, Karachi',
      coupon: 'SAVE10'
    } });
    const data = await res.json();
    log(`Checkout response: ${JSON.stringify(data).slice(0,300)} status=${res.status()}`);
    if (res.status() === 200 && data.orderId) {
      return { status: 'PASSED', log: `Checkout API passed: orderId=${data.orderId}` };
    }
    return { status: 'FAILED', log: `Unexpected checkout response: ${JSON.stringify(data)}`, error: 'No orderId' };
  } catch (e) {
    const msg = e.message;
    log(`Checkout API error: ${msg}`);
    return { status: 'FAILED', log: `Checkout API failed: ${msg}`, error: e.message };
  }
};
