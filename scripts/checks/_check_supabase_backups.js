const { chromium } = require('C:\\Users\\User\\.workbuddy\\binaries\\node\\workspace\\node_modules\\playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();

  const url = 'https://supabase.com/dashboard/project/tfyxaesejdfxykdalcsj/database/backups';
  console.log('正在打開：', url);
  await page.goto(url, { waitUntil: 'networkidle' });

  // 等待登入完成（URL 不再包含 /sign-in）
  console.log('請在瀏覽器中登入 Supabase（如果還沒登入）...');
  await page.waitForFunction(
    () => !window.location.href.includes('/sign-in') && !window.location.href.includes('/login'),
    { timeout: 120000 }
  );
  console.log('已登入，等待 Backups 頁面載入...');

  // 等頁面穩定
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // 截圖
  const screenshotPath = 'G:/草稿/待辦事項/APP_!/_supabase_backups.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('截圖已儲存：', screenshotPath);

  // 嘗試提取頁面上的備份資訊
  const info = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'))
      .map(h => h.innerText.trim())
      .filter(t => t.length > 0)
      .slice(0, 20);
    const buttons = Array.from(document.querySelectorAll('button'))
      .map(b => b.innerText.trim())
      .filter(t => t.length > 0)
      .slice(0, 20);
    const links = Array.from(document.querySelectorAll('a'))
      .map(a => a.innerText.trim())
      .filter(t => t.length > 0 && (t.includes('Restore') || t.includes('backup') || t.includes('PITR') || t.includes('Backups')))
      .slice(0, 10);
    return { text: text.slice(0, 3000), headings, buttons, links };
  });

  const outputPath = 'G:/草稿/待辦事項/APP_!/_supabase_backups_info.json';
  fs.writeFileSync(outputPath, JSON.stringify(info, null, 2), 'utf8');
  console.log('頁面資訊已儲存：', outputPath);

  console.log('\n--- 頁面標題 ---');
  console.log(info.headings.join('\n'));
  console.log('\n--- 相關按鈕 ---');
  console.log(info.buttons.join('\n'));
  console.log('\n--- 相關連結 ---');
  console.log(info.links.join('\n'));

  await browser.close();
})();
