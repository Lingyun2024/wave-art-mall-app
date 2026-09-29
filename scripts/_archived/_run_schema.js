const { Client } = require('C:/Users/User/.workbuddy/binaries/node/workspace/node_modules/pg');
const fs = require('fs');

async function main() {
  const client = new Client({
    host: 'db.tfyxaesejdfxykdalcsj.supabase.co',
    port: 5432,
    user: 'postgres',
    password: 'tfyxaesejdfxykdalcsj',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    family: 6
  });
  
  try {
    console.log('嘗試 IPv6 連接...');
    await client.connect();
    console.log('已連接。執行 schema...');
    
    const sql = fs.readFileSync('G:/草稿/待辦事項/APP_!/backend/supabase-schema.sql', 'utf-8');
    await client.query(sql);
    console.log('Schema 執行完成！');
    
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log(`\n已建立的資料表 (${tables.rows.length}個):`);
    tables.rows.forEach(r => console.log('  -', r.table_name));
    
  } catch (e) {
    console.log('IPv6 失敗:', e.message.substring(0, 150));
    console.log('\n改試 Pooler 域名...');
    
    // Supabase pooler 常見亞洲區域
    const regions = ['ap-southeast-1', 'ap-northeast-1', 'ap-southeast-2'];
    for (const region of regions) {
      const poolerHost = `aws-0-${region}.pooler.supabase.com`;
      const poolerClient = new Client({
        host: poolerHost,
        port: 6543,
        user: `postgres.tfyxaesejdfxykdalcsj`,
        password: 'tfyxaesejdfxykdalcsj',
        database: 'postgres',
        ssl: { rejectUnauthorized: false }
      });
      try {
        console.log(`嘗試 pooler: ${poolerHost}...`);
        await poolerClient.connect();
        console.log(`連上 ${region} pooler！執行 schema...`);
        const sql = fs.readFileSync('G:/草稿/待辦事項/APP_!/backend/supabase-schema.sql', 'utf-8');
        await poolerClient.query(sql);
        console.log('Schema 執行完成！');
        const tables = await poolerClient.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
        console.log(`已建立 ${tables.rows.length} 個資料表`);
        tables.rows.forEach(r => console.log('  -', r.table_name));
        await poolerClient.end();
        return; // 成功，退出
      } catch (pe) {
        console.log(`  ${region}: ${pe.message.substring(0, 80)}`);
        try { await poolerClient.end(); } catch {}
      }
    }
    console.log('\n所有連線方式都失敗。請從 Supabase Dashboard 複製完整的 Transaction pooler 連接串貼給我。');
    console.log('位置：Settings → Database → Connection string → Transaction pooler');
  } finally {
    try { await client.end(); } catch {}
  }
}

main();