/**
 * UI: Search with no results - intentional failure to demo screenshot
 * This will sometimes hit the 500 bug when BUG_MODE=true and empty query.
 * We expect empty state, but bug causes 500 -> should be recorded as FAILED with screenshot.
 */
module.exports = async ({ page, sampleAppUrl, log }) => {
  const base = sampleAppUrl || 'http://localhost:5000';
  await page.goto(`${base}/`);
  await page.click('text=Products');
  await page.waitForSelector('#searchQ');
  await page.fill('#searchQ', 'nonexistentproductxyz123');
  await page.waitForTimeout(1200);
  const msg = await page.textContent('#productsMsg');
  const grid = await page.textContent('#productsGrid');
  log(`Empty search msg: ${msg}, grid: ${grid?.slice(0,200)}`);
  // If bug triggered, productsMsg will show error
  if (msg && msg.toLowerCase().includes('failed')) {
    return { status: 'FAILED', log: `Search empty hit intentional bug: ${msg}`, error: 'Intentional bug: empty search 500' };
  }
  // If no products, it should show 0 products and empty grid
  if (msg && msg.includes('0 products')) {
    return { status: 'PASSED', log: `Empty search correctly shows 0 products` };
  }
  return { status: 'FAILED', log: `Unexpected empty search result: msg=${msg} grid=${grid}`, error: 'Empty state not shown' };
};
