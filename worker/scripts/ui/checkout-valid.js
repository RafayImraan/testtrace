/**
 * UI: Checkout with valid address
 */
module.exports = async ({ page, sampleAppUrl, log }) => {
  const base = sampleAppUrl || 'http://localhost:5000';
  await page.goto(`${base}/`);
  // add product first
  await page.click('text=Products');
  await page.waitForSelector('.product button');
  await page.click('.product button');
  page.on('dialog', async d => { await d.accept().catch(()=>{}); });
  await page.waitForTimeout(600);
  await page.click('text=Checkout');
  await page.waitForSelector('#checkoutAddr');
  await page.fill('#checkoutAddr', '123 Test St, Karachi');
  await page.fill('#checkoutCoupon', 'SAVE10');
  await page.click('text=Place Order');
  await page.waitForTimeout(1000);
  const msg = await page.textContent('#checkoutMsg');
  log(`Checkout msg: ${msg}`);
  if (msg && msg.toLowerCase().includes('confirmed')) {
    return { status: 'PASSED', log: `Checkout passed: ${msg}` };
  }
  return { status: 'FAILED', log: `Checkout failed, msg: ${msg}`, error: 'Checkout did not confirm' };
};
