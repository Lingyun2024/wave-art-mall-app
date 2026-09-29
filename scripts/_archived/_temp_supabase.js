const { chromium } = require('C:/Users/User/.workbuddy/binaries/node/workspace/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://supabase.com/dashboard/project/tfyxaesejdfxykdalcsj/settings/database', { waitUntil: 'networkidle', timeout: 30000 });

  console.log('瀏覽器已開啟，請在視窗中登入 Supabase（登入後會自動跳到 Database Settings）...');

  try {
    // 等登入後頁面出現 postgresql:// 連接串區塊
    await page.waitForFunction(() => {
      const body = document.body.innerText;
      return body.includes('postgresql://') || body.includes('Connection string');
    }, { timeout: 300000 });

    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'G:/草稿/待辦事項/APP_!/supabase_db_after_login.png', fullPage: true });

    // 提取連接串（優先 Transaction pooler 端口 6543）
    const connStr = await page.evaluate(() => {
      const body = document.body.innerText;
      const matches = body.match(/postgresql:\/\/postgres[^:\s\n]*:[^\s\n]+@[^:\s\n]+:\d+\/postgres[^\s\n]*/g);
      if (matches && matches.length > 0) {
        const txPooler = matches.find(m => m.includes(':6543'));
        return txPooler || matches[0];
      }
      for (const el of document.querySelectorAll('input, textarea')) {
        if (el.value && el.value.startsWith('postgresql://')) return el.value;
      }
      return null;
    });

    if (connStr) {
      console.log('===CONN_STR_START===');
      console.log(connStr);
      console.log('===CONN_STR_END===');
    } else {
      console.log('頁面已載入但未自動提取連接串。請手動複製貼上。');
    }

    await page.waitForTimeout(60000);
  } catch (e) {
    console.log('等待超時或錯誤:', e.message);
  }

  await browser.close();
})();