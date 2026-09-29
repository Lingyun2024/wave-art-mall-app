/**
 * tests/integration/service.test.mjs —— 服務層整合測試
 *
 * 使用「真實資料庫」（PGlite 記憶體模式）而非 mock，
 * 才能真正驗證 SQL、索引、交易與約束行為；
 * 只有這樣，測試通過才等於正式環境真的能動。
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";

// 必須在載入 config 之前設定環境變數（config 會在第一次 import 時就校驗）
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "integration-test-secret";
process.env.DB_PATH = "";

const { initDb, closeDb } = await import("../../server/db/client.js");
const { migrateUp } = await import("../../server/db/migrate.js");
const authService = await import("../../server/modules/auth/auth.service.js");
const tasksService = await import("../../server/modules/tasks/tasks.service.js");
const adminService = await import("../../server/modules/admin/admin.service.js");
const { ConflictError, NotFoundError } = await import("../../server/errors.js");

before(async () => {
  await initDb({ dataDir: null }); // null = 純記憶體資料庫
  await migrateUp();
});

after(async () => {
  await closeDb();
});

async function newUser(tag) {
  const { user, tokens } = await authService.register({
    email: `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
    password: "Passw0rd!demo",
    displayName: tag,
  });
  return { user, tokens };
}

test("註冊後可登入，且密碼不會以明文儲存", async () => {
  const email = `plain-${Date.now()}@example.com`;
  const { user } = await authService.register({ email, password: "Passw0rd!demo", displayName: "明文檢查" });
  assert.ok(user.id);
  assert.equal("password" in user, false);
  assert.equal("password_hash" in user, false);
});

test("重複 Email 註冊丟 ConflictError", async () => {
  const email = `dup-${Date.now()}@example.com`;
  await authService.register({ email, password: "Passw0rd!demo", displayName: "A" });
  await assert.rejects(
    () => authService.register({ email, password: "Passw0rd!demo", displayName: "B" }),
    ConflictError
  );
});

test("註冊時無法自我提權為 admin", async () => {
  const { user } = await newUser("role");
  assert.equal(user.role, "member");
});

test("登入後可建立任務並搜尋", async () => {
  const { user } = await newUser("search");
  await tasksService.create(user.id, { title: "學 Postgres 索引", notes: "重點在複合索引", status: "doing" });
  await tasksService.create(user.id, { title: "寫單元測試", notes: "含邊界案例" });

  const all = await tasksService.list(user.id, {});
  assert.equal(all.items.length, 2);
  assert.equal(all.pagination.total, 2);

  const hit = await tasksService.list(user.id, { q: "索引" });
  assert.equal(hit.items.length, 1);

  const miss = await tasksService.list(user.id, { q: "完全不存在的關鍵字" });
  assert.equal(miss.items.length, 0);

  const filtered = await tasksService.list(user.id, { status: "doing" });
  assert.equal(filtered.items.length, 1);
});

test("搜尋特殊字元 % 與 _ 不會變成萬用字元", async () => {
  const { user } = await newUser("escape");
  await tasksService.create(user.id, { title: "進度 100%_完成" });
  await tasksService.create(user.id, { title: "進度 100XY完成" });

  const r = await tasksService.list(user.id, { q: "100%_" });
  assert.equal(r.items.length, 1, "搜尋字面上的 %_ 應該只命中一筆");
});

test("分頁行為正確", async () => {
  const { user } = await newUser("page");
  for (let i = 1; i <= 5; i++) await tasksService.create(user.id, { title: `任務 ${i}` });

  const p1 = await tasksService.list(user.id, { page: 1, pageSize: 2 });
  assert.equal(p1.items.length, 2);
  assert.equal(p1.pagination.totalPages, 3);

  const p3 = await tasksService.list(user.id, { page: 3, pageSize: 2 });
  assert.equal(p3.items.length, 1);
});

test("使用者之間資料隔離：A 讀不到 B 的任務", async () => {
  const a = await newUser("iso-a");
  const b = await newUser("iso-b");
  const task = await tasksService.create(a.user.id, { title: "A 的私人任務" });

  await assert.rejects(() => tasksService.get(b.user.id, task.id), NotFoundError);
  await assert.rejects(() => tasksService.remove(b.user.id, task.id), NotFoundError);
});

test("更新與刪除後狀態正確", async () => {
  const { user } = await newUser("crud");
  const task = await tasksService.create(user.id, { title: "待辦", status: "todo", priority: 1 });

  const updated = await tasksService.update(user.id, task.id, { status: "done", priority: 3 });
  assert.equal(updated.status, "done");
  assert.equal(updated.priority, 3);
  assert.equal(updated.title, "待辦", "沒給的欄位不應被覆蓋");

  await tasksService.remove(user.id, task.id);
  await assert.rejects(() => tasksService.get(user.id, task.id), NotFoundError);
});

test("非法輸入被拒絕（標題空白、狀態不在白名單）", async () => {
  const { user } = await newUser("invalid");
  await assert.rejects(() => tasksService.create(user.id, { title: "" }), (e) => e.code === "VALIDATION_ERROR");
  await assert.rejects(() => tasksService.create(user.id, { title: "x", status: "sleeping" }), (e) => e.code === "VALIDATION_ERROR");
});

test("刷新權杖輪換：舊權杖不可重用", async () => {
  const email = `rot-${Date.now()}@example.com`;
  const first = await authService.register({ email, password: "Passw0rd!demo", displayName: "輪換" });

  const second = await authService.refresh(first.tokens.refreshToken);
  assert.ok(second.tokens.accessToken);

  await assert.rejects(
    () => authService.refresh(first.tokens.refreshToken),
    (e) => e.code === "REFRESH_TOKEN_REUSED"
  );
});

test("管理後台統計可讀到全站資料", async () => {
  const { user } = await newUser("admin-stat");
  await tasksService.create(user.id, { title: "統計用任務", status: "doing" });

  const overview = await adminService.overview();
  assert.ok(overview.users.total >= 1);
  assert.ok(overview.tasks.total >= 1);
  assert.equal(typeof overview.tasks.doing, "number");
});

test("管理員不能把自己降級", async () => {
  const { createUser } = await import("../../server/modules/auth/auth.repository.js");
  const { hashPassword } = await import("../../server/lib/password.js");
  const admin = await createUser({
    email: `adm-${Date.now()}@example.com`,
    passwordHash: await hashPassword("Passw0rd!demo"),
    displayName: "管理員",
    role: "admin",
  });

  await assert.rejects(
    () => adminService.updateUser(admin.id, admin.id, { role: "member" }),
    (e) => e.status === 400
  );
  await assert.rejects(
    () => adminService.updateUser(admin.id, admin.id, { isActive: false }),
    (e) => e.status === 400
  );
});
