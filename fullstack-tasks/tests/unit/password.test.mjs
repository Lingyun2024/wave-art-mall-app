import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../../server/lib/password.js";

test("雜湊後的密碼不可直接還原，且格式自帶演算法與鹽", async () => {
  const stored = await hashPassword("Passw0rd!demo");
  assert.match(stored, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.notEqual(stored, "Passw0rd!demo");
});

test("相同密碼兩次雜湊結果不同（鹽是隨機的）", async () => {
  const a = await hashPassword("same-password");
  const b = await hashPassword("same-password");
  assert.notEqual(a, b);
});

test("正確密碼驗證通過，錯誤密碼驗證失敗", async () => {
  const stored = await hashPassword("Passw0rd!demo");
  assert.equal(await verifyPassword("Passw0rd!demo", stored), true);
  assert.equal(await verifyPassword("passw0rd!demo", stored), false);
  assert.equal(await verifyPassword("", stored), false);
});

test("損毀或格式錯誤的雜湊值不會拋例外，只回傳 false", async () => {
  assert.equal(await verifyPassword("x", ""), false);
  assert.equal(await verifyPassword("x", "not-a-hash"), false);
  assert.equal(await verifyPassword("x", "bcrypt$aa$bb"), false);
  assert.equal(await verifyPassword("x", "scrypt$zz$not-hex"), false);
});
