# 事故报告：WAVE ART MALL 客户数据丢失

**日期**：2026-08-11（台北时间）
**项目**：wave-art-mall / Supabase 项目 `tfyxaesejdfxykdalcsj`
**严重度**：高（真实客户业务数据永久丢失）

## 一、事故事实
- **发生时间**：2026-08-11 19:09（台北时间，UTC 11:09）
- **直接原因**：手动执行 `backend/drop_and_schema.sql`（含 11 条 `DROP TABLE ... CASCADE`），清空了全部真实客户数据表
- **受影响数据**：
  - `orders` / `order_items`（真实订单、明细）→ 全空
  - `cart_items`（购物车）→ 全空
  - `favorites`（收藏）→ 全空
  - `shipping_addresses`（收货地址）→ 全空
  - `profiles`（注册账号，仅剩 1 个 `test` 测试账号）→ 几乎全空
  - 商品/分类/艺术家/闪购表（`products`/`categories`/`artists`/`flash_sales`）重建时只插回演示种子，仍为演示数据
- **前端表现**：前端 `js/supabaseClient.js` 直连数据库正常，但因查到空表，所有客户输入"看起来不见了"

## 二、恢复可能性排查（均失败）
| 途径 | 结果 |
|------|------|
| Supabase 官方备份（Management API 核实） | `pitr_enabled: false`、`backups: []` → 免费版无任何备份 |
| 本地工作区残留 | 仅有演示种子与前端 HTML 快照，无真实订单 |
| 库外副本（用户确认） | 电脑别处、同事端、Table Editor 导出均不存在 |

**结论：真实客户数据已永久丢失，无可行恢复路径。**

## 三、支付集成核查（关键）
线上 `pages/checkout.html` 付款方式仅为：**信用卡 / 貨到付款 / 銀行轉帳**（均为线下，未接入 Stripe / 绿界 ECPay / 蓝新 NewebPay / LINE Pay 等任何第三方支付网关）。
- 因此**无支付侧交易记录可反查订单**
- 仅"银行转账"客户可能已将款项转入您的银行账户，但无法对应到已丢失的订单
- `profiles` 已清空 → 客户联系方式（email/phone）亦丢失，主动联系只能靠您自有渠道（Line / 微信 / 邮件往来）

## 四、已处置
- ✅ 已隔离 `backend/drop_and_schema.sql`：重命名为 `drop_and_schema.sql.DO_NOT_RUN`，原位替换为警告占位文件，防止再次误执行
- ✅ 已归档孤儿后端文件（`api-service.js` / `page-integrations.js` / `INTEGRATION_GUIDE.md`）至 `backend/_archived/`，消除"改后端连不上"的混淆来源
- ✅ 已产出自动备份/恢复脚本（`scripts/backup_db.mjs`、`scripts/restore_db.mjs`、`scripts/.env.example`），`pg` 依赖已安装、语法校验与入口测试通过
- ✅ 已产出 `DATABASE_MIGRATION_GUIDE.md`（安全迁移规范）与 `UPGRADE_PITR_STEPS.md`（升级步骤）

## 五、善后交付与待用户执行
脚本与文档已于 2026-08-11 全部产出（见各文件）。以下仍需**用户本人**执行：
1. **开启后悔药**：升级 Supabase Pro（$25/月）启用 PITR（步骤见 `UPGRADE_PITR_STEPS.md`）；或至少每日运行 `node scripts/backup_db.mjs`（需先在 `scripts/.env` 填 `DATABASE_URL`）
2. **客户补救**：向银行核对"银行转账"入账；通过自有渠道（Line/微信/邮件）联系真实下单客户致歉，请其重新下单或提供原订单信息
3. **删除本次使用的 PAT**：`supabase.com/dashboard/account/tokens` 撤销 `sbp_2347...`

## 六、安全准则（建议固化为团队规范）
1. 任何结构变更前先 `pg_dump` / `backup_db.mjs` 全库
2. 用增量迁移，不用 `DROP ... CASCADE`
3. 付费计划开启 PITR 或每日自动备份
4. 访问令牌（PAT）用完即焚，不进代码库
