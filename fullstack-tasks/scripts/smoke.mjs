#!/usr/bin/env node
/**
 * scripts/smoke.mjs —— 端到端 API 冒煙測試
 *
 * 直接把 app 掛在隨機埠上，用真實 HTTP 請求走一遍主要動線：
 *   健康檢查 → 註冊 → 登入 → 任務 CRUD → 搜尋/分頁 → 權限檢查 → 管理後台
 * 任何一步不符預期就 exit 1，可放進 CI 當部署前門檻。
 */
import { config } from "../server/config.js";
import { setLogLevel } from "../server/logger.js";
import { initDb, closeDb } from "../server/db/client.js";
import { migrateUp } from "../server/db/migrate.js";
import { createApp } from "../server/app.js";

setLogLevel("silent");

const failures = [];
let passed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function call(base, path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function main() {
  await initDb();
  await migrateUp();

  const server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const stamp = Date.now();
  const email = `smoke${stamp}@example.com`;
  const password = "Passw0rd!smoke";

  console.log("\n[1] 健康檢查");
  const health = await call(base, "/health");
  check("GET /health 回 200 且 status=ok", health.status === 200 && health.json?.status === "ok", health.text);
  const ready = await call(base, "/ready");
  check("GET /ready 回 200 且資料庫為 up", ready.status === 200 && ready.json?.checks?.database === "up", ready.text);

  console.log("\n[2] 認證");
  const dupEmail = `dup${stamp}@example.com`;
  await call(base, "/api/auth/register", {
    method: "POST",
    body: { email: dupEmail, password, displayName: "重複測試" },
  });
  const dup = await call(base, "/api/auth/register", {
    method: "POST",
    body: { email: dupEmail, password, displayName: "重複測試" },
  });
  check("重複 Email 註冊回 409 EMAIL_TAKEN", dup.status === 409 && dup.json?.error?.code === "EMAIL_TAKEN", dup.text);

  const weak = await call(base, "/api/auth/register", {
    method: "POST",
    body: { email: `weak${stamp}@example.com`, password: "123", displayName: "弱密碼" },
  });
  check("密碼過短回 400 VALIDATION_ERROR", weak.status === 400 && weak.json?.error?.code === "VALIDATION_ERROR", weak.text);

  const reg = await call(base, "/api/auth/register", {
    method: "POST",
    body: { email, password, displayName: "冒煙測試" },
  });
  check("註冊成功回 201 且含 accessToken", reg.status === 201 && typeof reg.json?.accessToken === "string", reg.text);
  check("註冊角色固定為 member", reg.json?.user?.role === "member", reg.text);

  const token = reg.json?.accessToken;
  const refreshToken = reg.json?.refreshToken;

  const badLogin = await call(base, "/api/auth/login", {
    method: "POST",
    body: { email, password: "wrong-password" },
  });
  check("錯誤密碼回 401 INVALID_CREDENTIALS", badLogin.status === 401 && badLogin.json?.error?.code === "INVALID_CREDENTIALS", badLogin.text);

  const login = await call(base, "/api/auth/login", { method: "POST", body: { email, password } });
  check("登入成功回 200", login.status === 200 && typeof login.json?.accessToken === "string", login.text);

  const refreshed = await call(base, "/api/auth/refresh", { method: "POST", body: { refreshToken } });
  check("刷新權杖可換發新憑證", refreshed.status === 200 && typeof refreshed.json?.accessToken === "string", refreshed.text);

  const reused = await call(base, "/api/auth/refresh", { method: "POST", body: { refreshToken } });
  check("舊刷新權杖重用會被拒（輪換機制）", reused.status === 401 && reused.json?.error?.code === "REFRESH_TOKEN_REUSED", reused.text);

  console.log("\n[3] 權限");
  const noToken = await call(base, "/api/tasks");
  check("未帶憑證存取任務回 401", noToken.status === 401 && noToken.json?.error?.code === "MISSING_TOKEN", noToken.text);

  const badToken = await call(base, "/api/tasks", { token: "not.a.jwt" });
  check("無效憑證回 401 TOKEN_INVALID", badToken.status === 401 && badToken.json?.error?.code === "TOKEN_INVALID", badToken.text);

  console.log("\n[4] 任務 CRUD");
  const created = await call(base, "/api/tasks", {
    method: "POST",
    token,
    body: { title: "冒煙任務：寫測試", notes: "含搜尋關鍵字 UNICORN", status: "doing", priority: 3 },
  });
  check("新增任務回 201", created.status === 201 && created.json?.task?.id, created.text);
  const taskId = created.json?.task?.id;

  const invalid = await call(base, "/api/tasks", { method: "POST", token, body: { title: "" } });
  check("空白標題回 400 VALIDATION_ERROR", invalid.status === 400 && invalid.json?.error?.code === "VALIDATION_ERROR", invalid.text);

  const got = await call(base, `/api/tasks/${taskId}`, { token });
  check("可取得單筆任務", got.status === 200 && got.json?.task?.id === taskId, got.text);

  const patched = await call(base, `/api/tasks/${taskId}`, { method: "PATCH", token, body: { status: "done" } });
  check("更新任務狀態成功", patched.status === 200 && patched.json?.task?.status === "done", patched.text);

  const list = await call(base, "/api/tasks", { token });
  check("列表回傳 pagination 結構", list.status === 200 && list.json?.pagination?.total >= 1, list.text);

  const searched = await call(base, "/api/tasks?q=UNICORN", { token });
  check("關鍵字搜尋命中內容", searched.status === 200 && searched.json?.items?.length === 1, searched.text);

  const missed = await call(base, "/api/tasks?q=ZZQQ-not-exist", { token });
  check("搜尋無結果回空陣列", missed.status === 200 && missed.json?.items?.length === 0, missed.text);

  const paged = await call(base, "/api/tasks?pageSize=1", { token });
  check("分頁 pageSize=1 只回 1 筆", paged.status === 200 && paged.json?.items?.length === 1, paged.text);

  const overflow = await call(base, "/api/tasks?pageSize=9999", { token });
  check("pageSize 超限被夾到 100", overflow.status === 200 && overflow.json?.pagination?.pageSize === 100, overflow.text);

  console.log("\n[5] 資料隔離");
  const other = await call(base, "/api/auth/register", {
    method: "POST",
    body: { email: `other${stamp}@example.com`, password, displayName: "另一位" },
  });
  const otherToken = other.json?.accessToken;
  const crossRead = await call(base, `/api/tasks/${taskId}`, { token: otherToken });
  check("他人任務讀取回 404（資料隔離）", crossRead.status === 404, crossRead.text);

  console.log("\n[6] 管理後台");
  const asMember = await call(base, "/api/admin/overview", { token });
  check("一般會員進後台回 403", asMember.status === 403 && asMember.json?.error?.code === "FORBIDDEN", asMember.text);

  const adminLogin = await call(base, "/api/auth/login", {
    method: "POST",
    body: { email: "admin@example.com", password: "Passw0rd!demo" },
  });
  if (adminLogin.status !== 200) {
    console.log("  ⚠️  找不到示範管理員，請先執行 npm run seed（此項與後續 admin 檢查略過）");
  } else {
    const adminToken = adminLogin.json.accessToken;
    const overview = await call(base, "/api/admin/overview", { token: adminToken });
    check("管理員可讀總覽統計", overview.status === 200 && typeof overview.json?.users?.total === "number", overview.text);

    const users = await call(base, "/api/admin/users", { token: adminToken });
    check("管理員可列出使用者", users.status === 200 && Array.isArray(users.json?.items), users.text);

    const tasks = await call(base, "/api/admin/tasks", { token: adminToken });
    check("管理員可列出全站任務", tasks.status === 200 && Array.isArray(tasks.json?.items), tasks.text);

    const selfDowngrade = await call(base, `/api/admin/users/${adminLogin.json.user.id}`, {
      method: "PATCH",
      token: adminToken,
      body: { role: "member" },
    });
    check("管理員不能把自己降級", selfDowngrade.status === 400, selfDowngrade.text);
  }

  console.log("\n[7] 刪除");
  const deleted = await call(base, `/api/tasks/${taskId}`, { method: "DELETE", token });
  check("刪除任務成功", deleted.status === 200, deleted.text);
  const afterDelete = await call(base, `/api/tasks/${taskId}`, { token });
  check("刪除後再讀取回 404", afterDelete.status === 404, afterDelete.text);

  console.log("\n[8] 回應格式一致性");
  check("錯誤回應統一為 { error: { code, message } }", noToken.json?.error?.code && noToken.json?.error?.message, noToken.text);
  check("錯誤回應帶 requestId", typeof noToken.json?.error?.requestId === "string", noToken.text);

  server.close();
  await closeDb();

  console.log("\n────────────────────────────");
  console.log(`通過 ${passed} 項，失敗 ${failures.length} 項`);
  if (failures.length) {
    for (const f of failures) console.log(`  ❌ ${f}`);
    process.exit(1);
  }
  console.log("🟢 API 冒煙測試全部通過");
}

main().catch((err) => {
  console.error("冒煙測試執行失敗：", err);
  process.exit(1);
});
