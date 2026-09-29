# 異常處理手冊 · WAVE ART MALL

> 疊加自《虛擬團隊運營手冊_擴展版》§二
> 版本：v1.0（2026-09-22）｜適用：純靜態站 + Supabase + Vercel

---

## 一、異常分級與響應

| 等級 | 定義（本站實例） | 發現方式 | 響應時間 | 處理人 |
|---|---|---|---|---|
| **P0 致命** | 全站 5xx／Vercel 部署失敗／Supabase 服務中斷／資料外洩 | 使用者回報或監控告警 | 15 分鐘內 | 族族（人工） |
| **P1 嚴重** | 金流寫入錯誤／RLS 誤擋全部查詢／登入全面失效 | 門檻飄紅或使用者回報 | 1 小時內 | AI 排查 + 族族複核 |
| **P2 一般** | 單頁 404／單條 link 斷鏈／單項門檻失敗／OG 失效 | `npm run gates` | 當日內 | AI 自動修 |
| **P3 輕微** | 用詞不統一／排版微差／非核心文案過期 | 內容查證巡檢 | 下次迭代 | AI 自行修正 |

---

## 二、六個實戰劇本（皆為本站已發生過的事故）

### 劇本 A：Supabase SMTP 504（註冊後無法登入）

> **已發生**：2026-09-12，根因＝寄信 504 逾時 + `mailer_autoconfirm=false`

```
觸發：使用者回報「已註冊卻無法登入」
↓
1. 確認層級：影響全部新註冊者 → P1
2. 前端已備援（auth.html #auth-notice 常駐橫幅 + 504 友善訊息 + 「註冊未完成」分頁）→ 先止血
3. 根因二選一：
   a. Supabase Dashboard → Authentication → Emails → 修 SMTP 設定
   b. 或將 mailer_autoconfirm 設 true（開發期可接受，上線前應改回）
4. 驗證：走一次完整註冊 → 收信 → 登入
5. 寫入 docs/INCIDENT_REPORT_{日期}.md（沿用既有格式）
```

### 劇本 B：base.css hash 不同步 → build 紅

> **已發生**：改 token 忘記重編；`.sources.sha256` 檢查會擋

```
觸發：npm run build 顯示 hash mismatch
↓
1. 層級：P2（只影響本次提交，不影響線上）
2. 一鍵修復：npm run build:css
3. 重新跑 npm run gates 確認全綠
4. 若仍紅 → 檢查 tailwind.config.cjs 的 content 路徑是否遺漏新頁面
```

### 劇本 C：Tailwind tree-shake 掉自訂元件類別

> **已發生**：`@layer components` 的 glass-card / gradient-mesh 被搖掉，渲染全 fallback

```
觸發：頁面樣式「看起來沒吃到」
↓
1. 層級：P2
2. 確認：grep 該 class 是否存在於 out/rewrite/base/base.css
3. 修法：把該 class 寫進 tailwind.config.cjs 的 safelist
4. 重跑 npm run build:css，重驗
```

### 劇本 D：RLS 42501 匿名被擋

> **已發生**：PostgREST 匿名查詢回 42501

```
觸發：頁面資料讀不到，console 顯示 42501 permission denied
↓
1. 層級：判斷範圍 — 單表 → P2；全表 → P1
2. 確認：該表是否應開匿名讀？
   - 應開 → 補 SELECT policy（backend/reviews_policy_patch.sql 為範本）
   - 不應開 → 是程式碼用錯 client，回到 db.js 單一入口
3. 用 scripts/.env 的 SUPABASE_SECRET_KEY 走 admin API 驗證（勿寫進頁面）
```

### 劇本 E：Playwright e2e 失敗

> **已發生**：缺 headless shell、首頁 30s 逾時

```
觸發：npm run test:e2e 失敗
↓
1. 層級：P2（不影響線上）
2. 區分三種失敗：
   a. 環境缺件 → npx playwright install chromium
   b. 逾時 → 放寬 waitUntil（networkidle → domcontentloaded）
   c. 真實頁面錯誤 → 修頁面，這是最該修的
3. 絕不為了讓門檻變綠而註解掉測試（違 R 紅線精神）
```

### 劇本 F：同檔並行編輯互相覆蓋

> **已發生**：board.md 多個 Edit 並行，成功回報但只留一筆

```
觸發：檔案內容與預期不符，git diff 顯示少了幾筆修改
↓
1. 層級：P3（本地工作損失）
2. 立即：git diff 確認損失範圍，重新施加
3. 預防：同一檔案的編輯必須逐筆等完成，不可並行發送
```

---

### 劇本 G：訂單金額寫不進去 / 一直顯示 0

> **已發生**：2026-09-22 本地實測抓到（v1 SQL 若上線，商城結帳 100% 失敗）
> 兩種成因都要查，症狀相同但修法相反

```
觸發：結帳成功但金額為 0，或結帳直接報錯「沒有任何訂單項目」
↓
1. 層級：P0（金流全面中斷）
2. 鑑別（跑 `npm run test:money`，看 T4）：
   a. T4 步驟 a 就失敗 → 結算觸發器掛在 orders 上、依賴交易邊界
      → 成因：PostgREST 每次請求各自提交，orders 與 order_items 分兩次提交，
              第一次提交時明細尚空 → 被「無明細」規則擋下
      → 修法：結算改掛 order_items（v2 做法），不依賴交易邊界
   b. T4 步驟 a 成功但步驟 b 後金額仍為 0 → 兩個觸發器互相洗值
      → 成因：orders 的 BEFORE UPDATE 觸發器無條件歸零，
              把 order_items 觸發器算好的金額又洗掉
      → 修法：orders 觸發器按 TG_OP 分工（INSERT 歸零／UPDATE 由明細重算）
3. 復原：SQL 檔末尾有回滾指令，可整組拆掉回到「前端金額入庫」狀態（風險較高，僅急用）
4. 預防：DB 防線一律照「真實時序」測，不能只測「同一交易內插完」的理想情境
```

---

## 三、異常上報模板

```markdown
# INCIDENT_REPORT_{YYYY-MM-DD}

- 發生時間：
- 異常等級：P0 / P1 / P2 / P3
- 影響範圍：（幾頁 / 幾位使用者 / 哪個功能）
- 觸發條件：
- 根因：
- 已做處理：
- 待辦（如需人工）：
```

> 既有範本：`docs/INCIDENT_REPORT_2026-08-11.md`

---

## 四、與既有機制對位

| 手冊要求 | 本站既有物 | 本次補強 |
|---|---|---|
| 異常分級 | 無 | ✅ 本文件 §一 |
| 異常劇本 | 散落在對話存檔 | ✅ 本文件 §二（六個實戰劇本） |
| 上報模板 | INCIDENT_REPORT_2026-08-11.md | ✅ §三 模板化 |
| 監控告警 | 無 | 🔴 仍缺（見 METRICS.md §待辦 S2） |
