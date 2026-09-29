/**
 * migrate.js —— 可回滾的資料庫遷移執行器
 *
 * 規則：
 *  1. 每次 schema 變動都是一個 .sql 檔，檔名以版本號開頭（001_xxx.sql）。
 *  2. 每個檔案都要有 UP 與 DOWN 兩個區段，確保任何一次變更都能回復。
 *  3. 已執行過的版本記錄在 schema_migrations，重複執行安全（幂等）。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { query, exec, withTransaction } from "./client.js";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

function splitSections(sql) {
  // 只匹配整行的標記（前面僅允許空白），避免註解內出現同名子串造成誤切
  const upMatch = /^[ \t]*--[ \t]*=====[ \t]*UP[ \t]*=====/m.exec(sql);
  const downMatch = /^[ \t]*--[ \t]*=====[ \t]*DOWN[ \t]*=====/m.exec(sql);
  if (!upMatch || !downMatch) {
    throw new Error("遷移檔缺少 -- ===== UP ===== 或 -- ===== DOWN ===== 區段標記");
  }
  const upStart = upMatch.index + upMatch[0].length;
  const downStart = downMatch.index + downMatch[0].length;
  return {
    up: sql.slice(upStart, downMatch.index).trim(),
    down: sql.slice(downStart).trim(),
  };
}

export function listMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((file) => {
      const content = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
      return { version: file.replace(/\.sql$/, ""), file, ...splitSections(content) };
    });
}

async function ensureMigrationTable() {
  await exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function appliedVersions() {
  const rows = await query("SELECT version FROM schema_migrations ORDER BY version");
  return new Set(rows.map((r) => r.version));
}

/** 執行所有尚未套用的遷移 */
export async function migrateUp() {
  await ensureMigrationTable();
  const applied = await appliedVersions();
  const pending = listMigrations().filter((m) => !applied.has(m.version));

  if (pending.length === 0) {
    return { applied: [], message: "資料庫已是最新，無待套用遷移" };
  }

  const done = [];
  for (const m of pending) {
    // DDL + 版本記錄放在同一個交易：失敗就不會留下半套 schema
    await withTransaction(async (tx) => {
      await tx.exec(m.up);
      await tx.query("INSERT INTO schema_migrations (version) VALUES ($1)", [m.version]);
    });
    done.push(m.version);
  }
  return { applied: done, message: `已套用 ${done.length} 個遷移：${done.join(", ")}` };
}

/** 回滾最後一個（或指定數量的）遷移 */
export async function migrateDown(steps = 1) {
  await ensureMigrationTable();
  const appliedRows = await query("SELECT version FROM schema_migrations ORDER BY version DESC");
  const all = listMigrations();
  const rolled = [];

  for (let i = 0; i < steps && i < appliedRows.length; i++) {
    const version = appliedRows[i].version;
    const m = all.find((x) => x.version === version);
    if (!m) throw new Error(`找不到遷移檔：${version}`);

    await withTransaction(async (tx) => {
      await tx.exec(m.down);
      await tx.query("DELETE FROM schema_migrations WHERE version = $1", [version]);
    });
    rolled.push(version);
  }
  return { rolled, message: rolled.length ? `已回滾：${rolled.join(", ")}` : "沒有可回滾的遷移" };
}
