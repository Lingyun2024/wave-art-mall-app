/**
 * logger.js —— 結構化 JSON 日誌 + 請求 ID 貫穿
 *
 * 原則：
 *  1. 每一行都是單行 JSON，方便被任何日誌系統收走。
 *  2. 用 AsyncLocalStorage 讓「請求 ID」自動帶到後續所有非同步呼叫，
 *     不需要每層函式手動傳 req。
 *  3. 內建敏感欄位遮罩：密碼、權杖一律不落日誌。
 */
import { AsyncLocalStorage } from "node:async_hooks";

const als = new AsyncLocalStorage();

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEYS = new Set([
  "password",
  "newPassword",
  "currentPassword",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "secret",
]);

function redact(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === "object" && !(value instanceof Date) && !(value instanceof Error)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(k) ? "[REDACTED]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** 把後續的程式放進一個帶 context（請求 ID）的執行環境 */
export function withContext(context, fn) {
  return als.run(context ?? {}, fn);
}

export function getContext() {
  return als.getStore() ?? {};
}

function emit(level, message, meta = {}) {
  const threshold = LEVELS[currentLevel] ?? LEVELS.info;
  if (LEVELS[level] < threshold) return;

  const ctx = getContext();
  const record = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
    ...(ctx.method && ctx.path ? { method: ctx.method, path: ctx.path } : {}),
    ...redact(meta),
  };

  const line = JSON.stringify(record);
  if (level === "error" || level === "warn") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

// 需要在 config 載入後設定，這裡用惰性初始化避免循環依賴
let currentLevel = LEVELS.info;
export function setLogLevel(level) {
  currentLevel = LEVELS[level] ?? LEVELS.info;
}

export const logger = {
  debug: (msg, meta) => emit("debug", msg, meta),
  info: (msg, meta) => emit("info", msg, meta),
  warn: (msg, meta) => emit("warn", msg, meta),
  error: (msg, meta) => emit("error", msg, meta),
};
