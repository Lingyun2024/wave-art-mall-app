// restore_db.mjs <backup-file.json> [--force]
// 将备份 JSON 还原进数据库（使用 service_role 密钥，可绕过 RLS 写入）
//
// 安全机制（防止二次误清客户数据）：
//   1) 必须加 --force 才执行；否则仅警告并退出
//   2) 执行前自动对“当前库”做一次快照 → backups/pre-restore-<ts>.json（可回退）
//   3) 默认 insert + ignore-duplicates：只补回“不存在的记录”，不会覆盖/删除现有行
//   4) 不提供 truncate 模式；若需整体回滚到备份点，请用 Supabase SQL Editor + 数据库密码
//
// 用法：
//   node scripts/restore_db.mjs backups/backup-2026-08-11T14-43-13-413Z.json --force
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SECRET) {
  console.error("✗ 缺少 SUPABASE_URL / SUPABASE_SECRET_KEY，请检查 scripts/.env");
  process.exit(1);
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("用法: node scripts/restore_db.mjs <backup-file.json> [--force]");
  process.exit(1);
}
if (!existsSync(file)) {
  console.error("✗ 找不到备份文件: " + file);
  process.exit(1);
}

if (!force) {
  console.error("⚠️  危险操作拦截：还原会向数据库写入数据。");
  console.error("⚠️  当前可能有真实客户正在下单，误还原会污染/冲突现有数据。");
  console.error("⚠️  如确要认真还原到该备份点，请加 --force 参数重新执行。");
  console.error("    例: node scripts/restore_db.mjs " + file + " --force");
  process.exit(3);
}

// 父表先于子表，保证外键顺序
const TABLES = [
  "categories", "products", "artists", "flash_sales",
  "profiles", "orders", "order_items", "cart_items", "favorites", "shipping_addresses",
];

async function restGet(table) {
  const all = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${PAGE}&offset=${offset}`, {
      headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
    });
    if (!r.ok) throw new Error(`GET ${table} HTTP ${r.status}`);
    const rows = await r.json();
    if (!Array.isArray(rows)) throw new Error(`GET ${table} 非预期返回`);
    if (rows.length === 0) break;
    all.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function restInsert(table, rows) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`INSERT ${table} HTTP ${r.status}: ${txt.slice(0, 300)}`);
  }
  return rows.length;
}

(async () => {
  // 1) 还原前先对“当前库”做快照（回退点）
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = join(__dirname, "..", "backups");
  mkdirSync(outDir, { recursive: true });
  const preFile = join(outDir, `pre-restore-${stamp}.json`);
  const pre = { exportedAt: new Date().toISOString(), tables: {} };
  for (const t of TABLES) {
    try {
      pre.tables[t] = await restGet(t);
    } catch (e) {
      pre.tables[t] = { __error: e.message };
    }
  }
  writeFileSync(preFile, JSON.stringify(pre, null, 2));
  console.log(`📸 还原前快照已存 → ${preFile}（如需回退可从此文件还原）`);

  // 2) 读取目标备份
  const dump = JSON.parse(readFileSync(resolve(file), "utf8"));
  const tablesData = dump.tables || dump;
  let total = 0;
  for (const t of TABLES) {
    const rows = tablesData[t];
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      console.log(`· ${t.padEnd(20)} 跳过（备份中无数据）`);
      continue;
    }
    try {
      await restInsert(t, rows);
      console.log(`✓ ${t.padEnd(20)} 写入 ${rows.length} 行（冲突行忽略）`);
      total += rows.length;
    } catch (e) {
      console.error(`✗ ${t.padEnd(20)} 失败: ${e.message}`);
    }
  }
  console.log(`\n完成：共写入 ${total} 行（仅新增不存在的记录，未覆盖/删除现有数据）`);
})();
