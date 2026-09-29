/**
 * health.controller.js —— 健康檢查端點
 *
 * /health 存活探測：行程還活著就回 200，不做任何外部相依檢查（避免被重啟風暴放大）。
 * /ready  就緒探測：真的查一次資料庫，並確認遷移已套用，失敗就回 503 讓負載平衡摘除。
 */
import { query } from "../../db/client.js";
import { listMigrations } from "../../db/migrate.js";
import { asyncHandler } from "../../lib/asyncHandler.js";

const startedAt = Date.now();

export const health = (req, res) => {
  res.json({
    status: "ok",
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
};

export const ready = asyncHandler(async (req, res) => {
  const checks = {};
  let ok = true;

  try {
    const rows = await query("SELECT 1 AS ok");
    checks.database = rows[0]?.ok === 1 ? "up" : "down";
  } catch (err) {
    checks.database = "down";
    checks.databaseError = err?.message ?? String(err);
  }
  if (checks.database !== "up") ok = false;

  try {
    const applied = await query("SELECT count(*)::int AS n FROM schema_migrations");
    const expected = listMigrations().length;
    checks.migrations = { applied: applied[0]?.n ?? 0, expected };
    if (checks.migrations.applied < expected) ok = false;
  } catch {
    checks.migrations = { applied: 0, expected: listMigrations().length };
    ok = false;
  }

  res.status(ok ? 200 : 503).json({
    status: ok ? "ready" : "not_ready",
    checks,
    timestamp: new Date().toISOString(),
  });
});
