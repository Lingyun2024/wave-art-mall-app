// backup_db.mjs —— 用 Supabase REST (PostgREST) 导出「业务数据 JSON 留档」
//
// ⚠️ 重要定位：这只是业务数据 JSON 归档，不是 PostgreSQL 全库备份。
// 它受 Supabase RLS 约束（用 anon key 跑），因此：
//   - 只含 anon 角色「有权读取」的行；anon 无权读的行不会出现在产物里
//   - 不含数据库结构(schema)、表权限、RLS 策略、函数/触发器、Storage 文件
//   - 不能用于完整恢复数据库（缺结构 + 缺权限 + 缺无权重读行）
// 用途：定期把当前可读业务数据留一份 JSON 底，便于人工核对 / 轻量回看。
// 真要可恢复的数据库备份，请用 Supabase 官方 PITR / 托管的物理备份，而非本脚本。
//
// 优点：只需 URL + anon key（公开值，无需数据库密码）
// 用法：node scripts/backup_db.mjs
//   可选：node --env-file=scripts/.env scripts/backup_db.mjs
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ---- 简易 .env 加载（兼容未传 --env-file 的情况）----
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !ANON_KEY) {
  console.error("✗ 缺少 SUPABASE_URL / SUPABASE_ANON_KEY，请检查 scripts/.env");
  process.exit(1);
}

const TABLES = [
  "categories", "products", "artists", "flash_sales",
  "profiles", "orders", "order_items", "cart_items", "favorites", "shipping_addresses"
];

// 对 5xx / 429 / 网络层错误自动重试，避免偶发网关错误（如 HTTP 555）直接丢表
const RETRIES = 4;
const RETRY_BASE_MS = 800;

async function fetchWithRetry(url, headers, attempt = 0) {
  let r;
  try {
    r = await fetch(url, { headers });
  } catch (netErr) {
    if (attempt < RETRIES) {
      await new Promise((s) => setTimeout(s, RETRY_BASE_MS * (attempt + 1)));
      return fetchWithRetry(url, headers, attempt + 1);
    }
    throw netErr;
  }
  if (r.ok) return r;
  const retryable = r.status >= 500 || r.status === 429;
  if (retryable && attempt < RETRIES) {
    console.warn(`  · 重试 (${attempt + 1}/${RETRIES}) ${url.split("?")[0]} 返回 ${r.status}`);
    await new Promise((s) => setTimeout(s, RETRY_BASE_MS * (attempt + 1)));
    return fetchWithRetry(url, headers, attempt + 1);
  }
  const body = await r.text().catch(() => "");
  throw new Error(`HTTP ${r.status} ${body.slice(0, 200)}`);
}

async function fetchAll(table) {
  const all = [];
  let offset = 0;
  const PAGE = 1000;
  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${PAGE}&offset=${offset}`;
    const r = await fetchWithRetry(url, headers);
    const rows = await r.json();
    if (!Array.isArray(rows)) throw new Error("非预期返回: " + JSON.stringify(rows).slice(0, 200));
    if (rows.length === 0) break;
    all.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

(async () => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = join(__dirname, "..", "backups");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `backup-${stamp}.json`);

  const dump = { exportedAt: new Date().toISOString(), tables: {} };
  let ok = 0, fail = 0;
  for (const t of TABLES) {
    try {
      const rows = await fetchAll(t);
      dump.tables[t] = rows;
      console.log(`✓ ${t.padEnd(20)} ${rows.length} 行`);
      ok++;
    } catch (e) {
      console.error(`✗ ${t.padEnd(20)} 失败: ${e.message}`);
      dump.tables[t] = { __error: e.message };
      fail++;
    }
  }
  writeFileSync(outFile, JSON.stringify(dump, null, 2));
  console.log(`\n完成：成功 ${ok} / 失败 ${fail}`);
  console.log(`已写出 → ${outFile}`);
  if (fail > 0) process.exit(2);
})();
