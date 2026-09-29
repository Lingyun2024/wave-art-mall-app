/**
 * config.js —— 集中式環境變數管理
 *
 * 原則：
 *  1. 所有設定只能從環境變數來，程式碼內絕不出現任何密鑰或連線字串。
 *  2. 啟動時一次性校驗，缺必要變數就立刻「快速失敗」，不要等到執行到一半才炸。
 *  3. 對外只匯出一個凍結過的 config 物件，避免其他地方偷偷改值。
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 極簡 .env 讀取器（不引入 dotenv 依賴）。
 * 只補「尚未設定」的變數，系統環境變數優先級最高。
 */
function loadEnvFile() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // 去掉成對引號
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

function str(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function int(name, fallback) {
  const v = Number(str(name, String(fallback)));
  if (!Number.isInteger(v)) throw new Error(`環境變數 ${name} 必須是整數`);
  return v;
}

/** 解析「15m / 2h / 30s」這類時間長度，回傳秒數 */
export function parseDuration(text, fallbackSeconds) {
  if (!text) return fallbackSeconds;
  const m = /^(\d+)([smhd])$/.exec(String(text).trim());
  if (!m) throw new Error(`環境變數時間格式錯誤：${text}（應為 30s / 15m / 2h / 7d）`);
  const n = Number(m[1]);
  return n * { s: 1, m: 60, h: 3600, d: 86400 }[m[2]];
}

function required(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `缺少必要環境變數 ${name}。請複製 .env.example 為 .env 並填入（密鑰可用 node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" 產生）`
    );
  }
  return v;
}

const nodeEnv = str("NODE_ENV", "development");

// JWT_SECRET 在正式環境一律強制要求；測試環境允許用固定值以便重現。
const jwtSecret =
  nodeEnv === "test" ? str("JWT_SECRET", "test-only-secret-do-not-use-in-prod") : required("JWT_SECRET");

export const config = Object.freeze({
  nodeEnv,
  isProd: nodeEnv === "production",
  port: int("PORT", 4000),

  // 資料庫：PGlite 會把資料落在這個目錄（真實 PostgreSQL 語法，免安裝伺服器）
  dbPath: str("DB_PATH", "./.data/pgdata"),

  // CORS：明確來源白名單，永遠不使用萬用字元
  corsOrigins: str("CORS_ORIGINS", "http://localhost:4000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  jwt: Object.freeze({
    secret: jwtSecret,
    issuer: str("JWT_ISSUER", "fullstack-tasks"),
    accessTtlSeconds: parseDuration(str("ACCESS_TOKEN_TTL", "15m"), 900),
    refreshTtlSeconds: parseDuration(str("REFRESH_TOKEN_TTL", "30d"), 2592000),
  }),

  logLevel: str("LOG_LEVEL", nodeEnv === "test" ? "silent" : "info"),

  // 密碼雜湊成本（scrypt）
  password: Object.freeze({
    scryptKeylen: int("SCRYPT_KEYLEN", 64),
  }),
});
