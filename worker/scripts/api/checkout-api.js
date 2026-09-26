/**
 * API: Checkout API valid flow (sample-app)
 */
module.exports = async ({ log, sampleAppUrl, axios }) => {
  const base = sampleAppUrl || 'http://localhost:5000';
  try {
    const res = await axios.post(`${base}/api/checkout`, {
      items: [{ productId: 1, qty: 2, price: 25.99 }],
      address: '123 Test St, Karachi',
      coupon: 'SAVE10'
    });
    log(`Checkout response: ${JSON.stringify(res.data).slice(0,300)} status=${res.status}`);
    if (res.status === 200 && res.data.orderId) {
      return { status: 'PASSED', log: `Checkout API passed: orderId=${res.data.orderId}` };
    }
    return { status: 'FAILED', log: `Unexpected checkout response: ${JSON.stringify(res.data)}`, error: 'No orderId' };
  } catch (e) {
    const msg = e.response ? `status ${e.response.status} body ${JSON.stringify(e.response.data).slice(0,200)}` : e.message;
    log(`Checkout API error: ${msg}`);
    return { status: 'FAILED', log: `Checkout API failed: ${msg}`, error: e.message };
  }
};
