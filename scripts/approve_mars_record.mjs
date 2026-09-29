#!/usr/bin/env node
// 更新魏正隆的登記狀態為 approved / verified
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env');

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

const recordId = '4b08ba67-10be-4dd1-981f-8d95b3a53d4e'; // 魏正隆
const url = `${SUPABASE_URL}/rest/v1/mars_healing_registrations?id=eq.${recordId}`;

const headers = {
  apikey: SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const body = JSON.stringify({
  registration_status: 'approved',
  payment_status: 'verified',
});

try {
  const response = await fetch(url, { method: 'PATCH', headers, body });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  console.log('✅ 已更新魏正隆的狀態：');
  console.log(JSON.stringify(data, null, 2));
} catch (error) {
  console.error('❌ 更新失敗:', error.message);
  process.exit(1);
}
