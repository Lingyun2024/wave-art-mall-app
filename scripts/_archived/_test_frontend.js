const { chromium } = require('C:/Users/User/.workbuddy/binaries/node/workspace/node_modules/playwright');

(async () => {
  const errors = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('http://localhost:3001/%E9%A6%96%E9%A0%81.html', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  const title = await page.title();
  console.log('頁面標題:', title);
  console.log('JS 錯誤數:', errors.length);
  if (errors.length > 0) {
    console.log('錯誤明細:');
    errors.slice(0, 10).forEach((e,i) => console.log(`  ${i+1}. ${e.substring(0,200)}`));
  }
  
  // 測試導航到登入頁
  await page.goto('http://localhost:3001/%E5%9F%BA%E6%9C%AC%E8%B3%87%E6%96%99.html', { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(2000);
  console.log('登入頁標題:', await page.title());
  
  // 檢查 Supabase 是否初始化成功
  const supabaseStatus = await page.evaluate(() => {
    try {
      if (typeof supabaseClient !== 'undefined') return 'supabaseClient 已定義';
      return 'supabaseClient 未定義';
    } catch(e) { return 'Error: '+e.message; }
  });
  console.log('Supabase 狀態:', supabaseStatus);
  
  // 截圖
  await page.screenshot({ path: 'G:/草稿/待辦事項/APP_!/_test_screenshot.png' });
  console.log('截圖已保存');
  
  await browser.close();
})();