const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push('PAGEERR: ' + err.message));
  page.on('response', resp => {
    const url = resp.url();
    if (url.includes('supabase.co')) {
      console.log('Supabase response:', resp.status(), url.slice(0, 120));
    }
  });
  try {
    await page.goto('http://localhost:3012/index.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    console.log('--- Console errors ---');
    errors.forEach(e => console.log(e));
    console.log('--- Title ---');
    console.log(await page.title());
  } catch (e) {
    console.log('Error:', e.message);
  }
  await browser.close();
})();
