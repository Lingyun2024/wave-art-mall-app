#!/usr/bin/env node
/**
 * scripts/migrate.mjs —— 命令列執行資料庫遷移
 *   npm run migrate        套用所有待執行遷移
 *   npm run migrate:down   回滾最後一個遷移
 */
import { config } from "../server/config.js";
import { setLogLevel, logger } from "../server/logger.js";
import { initDb, closeDb } from "../server/db/client.js";
import { migrateUp, migrateDown } from "../server/db/migrate.js";

setLogLevel(config.logLevel);

const isDown = process.argv.includes("--down");
const steps = Number(process.argv.find((a) => a.startsWith("--steps="))?.split("=")[1] ?? 1);

try {
  await initDb();
  const result = isDown ? await migrateDown(steps) : await migrateUp();
  logger.info(result.message, result);
  console.log(`✅ ${result.message}`);
} catch (err) {
  logger.error("遷移失敗", { errMessage: err?.message, stack: err?.stack });
  console.error(`❌ 遷移失敗：${err?.message}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
