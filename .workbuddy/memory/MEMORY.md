# WAVE ART MALL 專案長期記憶

## 三條互不相通的途徑（2026-09-22 查證，族族糾正後確立）

| 途徑 | 怎麼走 | 觸發時機 |
|---|---|---|
| **網站上線** | `vercel deploy`（CLI 直接上傳本目錄，`.vercel/project.json` = `wave-art-mall`，`outputDirectory "."`） | 手動執行，commit **不會**觸發 |
| **本地 git** | 無遠端（`git remote` 為空），從不 push | 只作版本紀錄 |
| **Supabase** | SQL Editor 手動執行 / Dashboard 設定 | 完全獨立，不在部署範圍內 |

**推論（常犯錯點）**：本地改檔 ≠ 線上有。要確認同步跑 `npm run check:drift`（只讀，sha256 比對 40 檔）。
SQL 類防線（trigger / policy）永遠不會因部署而生效，必須另行執行。

## 專案約定

- 靜態站：純 HTML + Tailwind（重寫期用 CLI 編譯 `out/rewrite/base/base.css`，既有 33 頁仍用 Play CDN 過渡）
- 品質門檻：`npm run gates`（lint / check:links / check:html / build / **test:money** / test:e2e）
- 金流防線：`backend/order_amount_guard.sql`（v2，2026-09-22 修）。**DB trigger 測試必須含「兩次獨立提交」的真實時序情境**——PostgREST 每次請求各自提交，只測同一交易的理想情境會漏掉致命缺陷。
- 營運文件在 `docs/ops/`（異常手冊／指標／風險登記 R1–R8／斷點恢復／四能力對位／未決冊）
- 未決事項看 `docs/ops/OPEN-DECISIONS.md`，逾期規則：2026-09-24 自動採推薦案

## 待族族處理（動線上，我方不做）

1. Supabase SMTP 504 根因（R1）
2. 執行 `order_amount_guard.sql` v2（R8，未執行前商城無金額防線）
3. 線上監控（R6）
4. 四項文案拍板：A1 火星色票／A2 GALACTIC 文字／P1 過期截止日／P2 holiday 疊字
