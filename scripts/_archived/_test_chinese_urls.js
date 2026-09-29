const { chromium } = require('C:\\Users\\User\\.workbuddy\\binaries\\node\\workspace\\node_modules\\playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const tests = [
    'http://localhost:3002/首頁.html',
    'http://localhost:3002/基本資料.html',
    'http://localhost:3002/購買清單.html',
    'http://localhost:3002/產品介紹.html?id=1',
  ];

  for (const url of tests) {
    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
      const title = await page.title();
      console.log(`${url} -> HTTP ${response.status()} | ${title}`);
    } catch (e) {
      console.log(`${url} -> ERROR: ${e.message}`);
    }
  }

  await browser.close();
})();
