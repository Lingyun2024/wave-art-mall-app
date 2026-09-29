import test from "node:test";
import assert from "node:assert/strict";
import { signToken, verifyToken } from "../../server/lib/jwt.js";

const opts = { secret: "unit-test-secret", issuer: "unit-test" };

test("簽發後可驗證，且帶回正確的 claims", () => {
  const { token, jti } = signToken({ sub: "user-1", role: "admin", typ: "access" }, opts, 900);
  const claims = verifyToken(token, opts, "access");
  assert.equal(claims.sub, "user-1");
  assert.equal(claims.role, "admin");
  assert.equal(claims.typ, "access");
  assert.equal(claims.jti, jti);
  assert.ok(claims.exp > Math.floor(Date.now() / 1000));
});

test("簽章被竄改會驗證失敗", () => {
  const { token } = signToken({ sub: "user-1", typ: "access" }, opts, 900);
  const parts = token.split(".");
  const forged = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -2)}xx`;
  assert.throws(() => verifyToken(forged, opts, "access"), /簽章驗證失敗/);
});

test("用別的密鑰簽的權杖無法通過驗證", () => {
  const { token } = signToken({ sub: "user-1", typ: "access" }, opts, 900);
  assert.throws(() => verifyToken(token, { ...opts, secret: "another-secret" }, "access"));
});

test("過期權杖被拒絕", () => {
  const { token } = signToken({ sub: "user-1", typ: "access" }, opts, -10);
  assert.throws(() => verifyToken(token, opts, "access"), /權杖已過期/);
});

test("權杖類型不符會被拒絕（拿 refresh 當 access 用）", () => {
  const { token } = signToken({ sub: "user-1", typ: "refresh" }, opts, 900);
  assert.throws(() => verifyToken(token, opts, "access"), /權杖類型不符/);
});

test("簽發者不符會被拒絕", () => {
  const { token } = signToken({ sub: "user-1", typ: "access" }, opts, 900);
  assert.throws(() => verifyToken(token, { ...opts, issuer: "other" }, "access"), /簽發者不符/);
});

test("格式錯誤的權杖被拒絕", () => {
  assert.throws(() => verifyToken("abc", opts, "access"));
  assert.throws(() => verifyToken("", opts, "access"));
  assert.throws(() => verifyToken(undefined, opts, "access"));
});
