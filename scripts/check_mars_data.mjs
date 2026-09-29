#!/usr/bin/env node
// 臨時腳本：檢查火星療癒登記資料筆數
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env');

// 手動解析 .env 檔案
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [key, ...valueParts] = trimmed.split('=');
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim();
  }
}

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('❌ 缺少 SUPABASE_URL 或 SUPABASE_SECRET_KEY');
  process.exit(1);
}

// 查詢所有資料，不限制狀態
const url = `${SUPABASE_URL}/rest/v1/mars_healing_registrations?select=id,representative_name,registration_status,payment_status,created_at&order=created_at.asc`;

const headers = {
  apikey: SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
};

try {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  console.log(`✅ 符合條件的資料共 ${data.length} 筆：`);
  console.log(JSON.stringify(data, null, 2));
} catch (error) {
  console.error('❌ 查詢失敗:', error.message);
  process.exit(1);
}
