const { chromium } = require('C:\\Users\\User\\.workbuddy\\binaries\\node\\workspace\\node_modules\\playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();

  const url = 'https://supabase.com/dashboard/project/tfyxaesejdfxykdalcsj/database/backups';
  console.log('正在打開：', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  console.log('頁面已載入，請在瀏覽器中登入（如果需要）');
  console.log('登入後，按 Enter 鍵回到這裡，我會自動截圖並提取備份資訊。');

  // 等待使用者手動登入（給 2 分鐘）
  await page.waitForTimeout(120000);

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const screenshotPath = 'G:/草稿/待辦事項/APP_!/_supabase_backups.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('截圖已儲存：', screenshotPath);

  const info = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'))
      .map(h => h.innerText.trim())
      .filter(t => t.length > 0)
      .slice(0, 30);
    const buttons = Array.from(document.querySelectorAll('button'))
      .map(b => b.innerText.trim())
      .filter(t => t.length > 0)
      .slice(0, 30);
    return { text: text.slice(0, 5000), headings, buttons };
  });

  const outputPath = 'G:/草稿/待辦事項/APP_!/_supabase_backups_info.json';
  fs.writeFileSync(outputPath, JSON.stringify(info, null, 2), 'utf8');
  console.log('頁面資訊已儲存：', outputPath);
  console.log('\n--- 頁面標題 ---');
  console.log(info.headings.join('\n'));
  console.log('\n--- 按鈕文字 ---');
  console.log(info.buttons.join('\n'));

  await browser.close();
})();
