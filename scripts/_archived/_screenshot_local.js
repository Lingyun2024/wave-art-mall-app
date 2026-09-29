const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto('http://localhost:3013/index.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000); // wait for fonts
    await page.screenshot({ path: 'G:/草稿/待辦事項/APP_!/_local_preview.png', fullPage: true });
    console.log('Screenshot saved to _local_preview.png');
    console.log('Title:', await page.title());
    // Check if material icon text is visible
    const iconTexts = await page.$$eval('.material-symbols-outlined', els => els.map(e => e.textContent.trim()));
    console.log('Icon texts found:', iconTexts.slice(0, 10));
  } catch (e) {
    console.log('Error:', e.message);
  }
  await browser.close();
})();
