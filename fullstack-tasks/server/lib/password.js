/**
 * password.js —— 密碼雜湊（node:crypto scrypt，零外部依賴）
 *
 * 原則：
 *  1. 永不明文儲存密碼；每組密碼都用獨立的隨機鹽。
 *  2. 驗證時用 timingSafeEqual 做常數時間比對，避免旁路攻擊。
 *  3. 雜湊格式自帶演算法前綴（scrypt$salt$hash），未來換演算法可平滑升級。
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const SALT_BYTES = 16;

export async function hashPassword(plain, keylen = 64) {
  if (typeof plain !== "string" || plain.length === 0) {
    throw new Error("密碼不可為空");
  }
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(plain, salt, keylen);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(plain, stored) {
  if (typeof plain !== "string" || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = await scryptAsync(plain, salt, expected.length);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
