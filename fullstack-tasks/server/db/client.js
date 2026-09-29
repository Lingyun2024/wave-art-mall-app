/**
 * client.js —— 資料庫連線單例與查詢協助函式
 *
 * 這裡用的是 PGlite：把真正的 PostgreSQL 編譯成 WASM 跑在 Node 裡，
 * 語法與正式環境的 Postgres 完全一致（uuid / timestamptz / ILIKE / 交易都可用），
 * 好處是不用安裝資料庫伺服器就能開發與跑測試；
 * 要換成正式的 Postgres 伺服器，只要把這個檔案的底層換成 pg 連線池即可，
 * 上層的 repository 完全不用改。
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { config } from "../config.js";
import { logger } from "../logger.js";

let db = null;

/**
 * 初始化資料庫連線（整個行程只應呼叫一次）
 * @param {{ dataDir?: string | null }} [options] 傳 null 表示使用純記憶體資料庫（測試用）
 */
export async function initDb(options = {}) {
  if (db) return db;

  const dataDir = options.dataDir === null ? undefined : options.dataDir ?? config.dbPath;
  // PGlite 的檔案層 mkdir 不遞迴建立父目錄，先確保上層存在
  if (dataDir) mkdirSync(dirname(dataDir), { recursive: true });
  db = dataDir ? await PGlite.create(dataDir) : new PGlite();
  await db.waitReady;

  const { rows } = await db.query("SELECT version() AS v");
  logger.info("資料庫已連線", { dataDir: dataDir ?? "(in-memory)", version: String(rows[0].v).slice(0, 40) });
  return db;
}

export function getDb() {
  if (!db) throw new Error("資料庫尚未初始化，請先呼叫 initDb()");
  return db;
}

/** 一般查詢：回傳列陣列 */
export async function query(text, params = []) {
  const result = await getDb().query(text, params);
  return result.rows ?? [];
}

/** 單列查詢：找不到回傳 null */
export async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}

/** 多語句執行（遷移用，simple protocol） */
export async function exec(text) {
  return getDb().exec(text);
}

/**
 * 交易：多步寫入一定要包在交易裡，任一步失敗整批回滾
 * @template T
 * @param {(tx: import("@electric-sql/pglite").Transaction) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
  return getDb().transaction(fn);
}

export async function closeDb() {
  if (!db) return;
  await db.close();
  db = null;
  logger.info("資料庫已關閉");
}
