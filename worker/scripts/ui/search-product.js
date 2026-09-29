/**
 * UI: Search product by name
 */
module.exports = async ({ page, sampleAppUrl, log }) => {
  const base = sampleAppUrl || 'http://localhost:5000';
  await page.goto(`${base}/`);
  await page.click('text=Products');
  await page.waitForSelector('#searchQ');
  await page.fill('#searchQ', 'mouse');
  await page.waitForSelector('.product button');
  await page.waitForTimeout(1000);
  const grid = await page.textContent('#productsGrid');
  log(`Search results: ${grid?.slice(0, 200)}`);
  if (grid && grid.toLowerCase().includes('mouse')) {
    return { status: 'PASSED', log: `Search found mouse: ${grid.slice(0, 100)}` };
  }
  return { status: 'FAILED', log: `Search did not find expected product, grid: ${grid}`, error: 'Search failed' };
};
