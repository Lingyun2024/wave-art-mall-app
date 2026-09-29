# 升级 Supabase Pro 并开启 PITR 步骤

> 目的：为 WAVE ART MALL 项目（`tfyxaesejdfxykdalcsj`）建立"后悔药"。
> 2026-08-11 事故中，该项目为免费版，`pitr_enabled=false`、`backups=[]`，数据清空后完全无法恢复。开启 PITR 后，可精确恢复到任意时间点。

## 费用
- Supabase Pro 计划：**US$25 / 月**（按官网现行价，以结账页为准）。
- PITR 包含在 Pro 计划内，无需额外付费；免费版不提供。

## 操作步骤（需你本人在后台完成，AI 无法代付）

1. 登录 https://supabase.com/dashboard
2. 左上角选组织 → 选中项目 **wave-art-mall**（`tfyxaesejdfxykdalcsj`）
3. 左侧选单 → **Settings → Billing**（或 Project Settings → Upgrade）
4. 选择 **Pro** 计划，按提示绑定支付方式并完成升级
5. 升级完成后，左侧选单 → **Database → Backups**
6. 找到 **Point in Time Recovery (PITR)**，点击 **Enable**
7. 启用后页面会显示：
   - Earliest recoverable time（最早可还原时间）
   - Latest recoverable time（最近可还原时间，通常距现在约 1–2 分钟）
8. 记下「Earliest recoverable」时间，确保覆盖你每次重要变更前的窗口

## 恢复演练（将来万一再出事）
- 在 Backups 页面点 **Restore to a point in time**
- 选择事故前的时间点（如某次大改之前 5 分钟）
- 系统会要求你确认，并可能要求新建一个恢复用的数据库
- 恢复完成后核对 `orders` / `profiles` 等表行数是否回到预期

## 补充建议
- 即使开了 PITR，仍建议每日跑一次 `scripts/backup_db.mjs` 留一份本地/ Git 副本，双保险。
- PITR 有保留期（Pro 通常 7 天），超过保留期的历史事件无法恢复，长期归档仍要靠定期 dump。
- 支付凭据（Stripe / 绿界等）若将来接入，其侧的交易记录也是独立保障，与数据库备份互补。
