import test from "node:test";
import assert from "node:assert/strict";
import { parse, parsePagination } from "../../server/lib/validate.js";
import { ValidationError } from "../../server/errors.js";

const schema = {
  email: { type: "string", required: true, email: true, max: 254 },
  password: { type: "string", required: true, min: 8, max: 128 },
  status: { type: "string", oneOf: ["todo", "doing", "done"], default: "todo" },
};

test("合法輸入通過，並套用預設值", () => {
  const out = parse({ email: "a@b.com", password: "Passw0rd!" }, schema);
  assert.equal(out.email, "a@b.com");
  assert.equal(out.status, "todo");
});

test("缺必填欄位丟 ValidationError，details 指向正確欄位", () => {
  try {
    parse({ email: "a@b.com" }, schema);
    assert.fail("應該丟錯");
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    assert.equal(err.status, 400);
    assert.equal(err.code, "VALIDATION_ERROR");
    assert.equal(err.details[0].field, "password");
  }
});

test("Email 格式錯誤被擋", () => {
  assert.throws(() => parse({ email: "not-an-email", password: "Passw0rd!" }, schema), ValidationError);
});

test("不在白名單內的列舉值被擋", () => {
  assert.throws(
    () => parse({ email: "a@b.com", password: "Passw0rd!", status: "sleeping" }, schema),
    ValidationError
  );
});

test("schema 沒定義的欄位會被丟棄（防止多餘欄位寫入資料庫）", () => {
  const out = parse({ email: "a@b.com", password: "Passw0rd!", isAdmin: true }, schema);
  assert.equal("isAdmin" in out, false);
});

test("非物件主體被擋", () => {
  assert.throws(() => parse(null, schema), ValidationError);
  assert.throws(() => parse([], schema), ValidationError);
});

test("分頁參數會被夾在合理範圍", () => {
  assert.deepEqual(parsePagination({ page: "0", pageSize: "0" }), { page: 1, pageSize: 1, offset: 0 });
  assert.deepEqual(parsePagination({ page: "3", pageSize: "10" }), { page: 3, pageSize: 10, offset: 20 });
  assert.deepEqual(parsePagination({ pageSize: "99999" }), { page: 1, pageSize: 100, offset: 0 });
  assert.deepEqual(parsePagination({ page: "abc", pageSize: "xyz" }), { page: 1, pageSize: 20, offset: 0 });
});
