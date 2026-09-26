/**
 * UI: Add product to cart increments count
 */
module.exports = async ({ page, sampleAppUrl, log }) => {
  const base = sampleAppUrl || 'http://localhost:5000';
  await page.goto(`${base}/`);
  await page.click('text=Products');
  await page.waitForSelector('.product button');
  const countBefore = await page.textContent('#cartCount');
  log(`Cart count before: ${countBefore}`);
  await page.click('.product button');
  await page.waitForTimeout(500);
  await page.on('dialog', async d => { await d.accept(); });
  // handle alert
  page.on('dialog', async dialog => { log(`Dialog: ${dialog.message()}`); await dialog.accept(); });
  await page.waitForTimeout(500);
  const countAfter = await page.textContent('#cartCount');
  log(`Cart count after: ${countAfter}`);
  const afterNum = parseInt(countAfter || '0', 10);
  const beforeNum = parseInt(countBefore || '0', 10);
  if (afterNum > beforeNum) {
    return { status: 'PASSED', log: `Cart incremented from ${beforeNum} to ${afterNum}` };
  }
  return { status: 'FAILED', log: `Cart did not increment: before ${beforeNum} after ${afterNum}`, error: 'Cart count not incremented' };
};
