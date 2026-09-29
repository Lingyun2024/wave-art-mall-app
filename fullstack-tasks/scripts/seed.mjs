#!/usr/bin/env node
/**
 * scripts/seed.mjs —— 建立示範資料（管理員 + 一般使用者 + 任務）
 *
 * 幂等：已存在的 Email 會跳過，不會重複建立。
 * 密碼與 Email 都寫在這裡是「示範帳號」，實務上應改由環境變數帶入。
 */
import { config } from "../server/config.js";
import { setLogLevel, logger } from "../server/logger.js";
import { initDb, closeDb, query } from "../server/db/client.js";
import { migrateUp } from "../server/db/migrate.js";
import { hashPassword } from "../server/lib/password.js";
import { createUser, findUserByEmail } from "../server/modules/auth/auth.repository.js";
import { insert } from "../server/modules/tasks/tasks.repository.js";

setLogLevel(config.logLevel);

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "Passw0rd!demo";
const ADMIN = { email: "admin@example.com", displayName: "站長", role: "admin" };
const MEMBER = { email: "member@example.com", displayName: "一般會員", role: "member" };

const DEMO_TASKS = [
  { title: "完成全棧範本 README", notes: "含啟動步驟與架構說明", status: "doing", priority: 3 },
  { title: "檢查品質門檻是否全綠", notes: "npm run gates", status: "todo", priority: 2 },
  { title: "把 PGlite 換成正式 Postgres", notes: "只需改 server/db/client.js", status: "todo", priority: 1 },
  { title: "設計任務列表的分頁樣式", notes: "", status: "done", priority: 2 },
  { title: "補上前端錯誤提示對應表", notes: "4xx 不重試、5xx 重試最多 3 次", status: "todo", priority: 2 },
];

async function upsertUser(spec) {
  const existing = await findUserByEmail(spec.email);
  if (existing) {
    console.log(`· 已存在，略過：${spec.email}`);
    return existing;
  }
  const user = await createUser({
    email: spec.email,
    passwordHash: await hashPassword(DEMO_PASSWORD, config.password.scryptKeylen),
    displayName: spec.displayName,
    role: spec.role,
  });
  console.log(`+ 已建立：${spec.email}（${spec.role}）`);
  return user;
}

try {
  await initDb();
  await migrateUp();

  const admin = await upsertUser(ADMIN);
  const member = await upsertUser(MEMBER);

  const rows = await query("SELECT count(*)::int AS n FROM tasks WHERE user_id = $1", [member.id]);
  if (rows.length === 0 || rows[0].n === 0) {
    for (const t of DEMO_TASKS) {
      await insert({ userId: member.id, ...t, dueDate: null });
    }
    console.log(`+ 已為 ${MEMBER.email} 建立 ${DEMO_TASKS.length} 筆示範任務`);
  } else {
    console.log(`· ${MEMBER.email} 已有 ${rows[0].n} 筆任務，略過示範資料`);
  }

  logger.info("種子資料完成", { admin: admin.email, member: member.email });
  console.log("\n示範帳號（密碼皆為 %s）：", DEMO_PASSWORD);
  console.log(`  管理員：${ADMIN.email}`);
  console.log(`  會員　：${MEMBER.email}`);
} catch (err) {
  logger.error("種子資料失敗", { errMessage: err?.message });
  console.error(`❌ 失敗：${err?.message}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
