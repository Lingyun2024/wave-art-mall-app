# 数据库安全迁移规范（WAVE ART MALL）

> 适用：所有对 Supabase 表结构（DDL）的变更。
> 背景：2026-08-11 因手动执行 `DROP TABLE ... CASCADE` 整表重建，清空了全部真实客户数据且无法恢复。本规范用于杜绝此类事故。

## 铁律

1. **任何结构变更前，先全库备份。**
   - 跑一次 `node scripts/backup_db.mjs`（需先在 `scripts/.env` 填好 `DATABASE_URL`）。
   - 备份落在 `backups/YYYY-MM-DD_HH-MM/`，确认有 `meta.json` 后再继续。

2. **禁止 `DROP TABLE ... CASCADE` 整表重建。**
   - 宁可多写几条 `ALTER TABLE`，也不要为"改个字段"把整张表连同数据一起删掉。
   - 演示种子数据请用独立的 `INSERT`（带 `ON CONFLICT DO NOTHING`），与结构变更脚本分开。

3. **用增量迁移，不用全量重建。**
   - 新增列：`ALTER TABLE products ADD COLUMN IF NOT EXISTS edition text;`
   - 改列类型：`ALTER TABLE orders ALTER COLUMN total TYPE numeric(12,2);`
   - 改名：`ALTER TABLE orders RENAME COLUMN amt TO total;`
   - 加索引：`CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);`
   - 每次变更写成一个带日期前缀的 `.sql` 文件，例如 `migrations/20260811_add_order_note.sql`，便于回溯。

4. **RLS 策略随表结构一起管。**
   - 改表后确认 RLS 策略仍正确（尤其 `orders` / `profiles` / `cart_items` 涉及客户隐私）。
   - 不要把 `service_role` key 放进前端或提交到代码库。

5. **保留后悔药。**
   - 付费计划开启 PITR（见 `UPGRADE_PITR_STEPS.md`），或至少每日自动跑备份脚本。
   - 访问令牌（PAT）用完即焚，不进代码库、不进 `.env` 提交。

## 变更流程（建议）

1. 备份：`node scripts/backup_db.mjs`
2. 写迁移文件：`migrations/YYYYMMDD_描述.sql`（只含 ALTER，不含 DROP）
3. 在 Supabase SQL Editor 或 CLI 执行，确认无报错
4. 用前端或 `scripts/restore_db.mjs` 验证数据完好
5. 把迁移文件提交到 Git（`.env` 和 `backups/` 加入 `.gitignore`）

## 误删后的唯一自救（若已开 PITR / 有备份）

- 有 PITR：Supabase → Database → Backups → Point in Time Recovery，选清空前的时间点恢复。
- 有 `backups/` 快照：`node scripts/restore_db.mjs backups/YYYY-MM-DD_HH-MM`。
- 两者皆无：数据无法恢复，只能联系客户重新录入（本次即为此情况）。
