# 待改清單 — 一次看懂「要改哪些地方」

> 彙整來源：站台體檢（09-11）、宗教 8 頁／火星 7 頁／七七地赦 5 頁／管理後台 4 頁／商城 10 頁分析（09-12）、
> content-audit（09-13）、ops 風險登記與未決冊（09-22）
> **本表每一條都於 2026-09-22 重新實測過**，不是複製舊報告的結論。
>
| 組 | 意義 | 誰做 |
|---|---|---|
| **A** | 動 Supabase（線上），需族族執行 | 你 |
| **B** | 業務決策，需族族拍板 | 你 |
| **C** | 本地工程，我可直接動手 | 我（等你下令） |
| **D** | Phase 3 重寫（24 頁） | 我（等 A/B 收斂） |

優先級：🔴 不做會出事／有錢損　🟠 明顯缺陷　🟡 體驗／技術債　🟢 維護性

---

## A 組：動 Supabase（線上，需你執行）

| # | 檔案 | 要改什麼 | 不做的後果 | 優先 |
|---|---|---|---|---|
| **A1** | `backend/order_amount_guard.sql`（v2） | SQL Editor 貼上執行 | **商城訂單金額完全無防線**，任何登入者可用 Console 插 1 元單 | 🔴 |
| **A2** | `backend/reviews_policy_patch.sql` | SQL Editor 貼上執行 | `pages/review.html` **已上線但送出會被 RLS 擋**，評價功能實際是壞的（新發現，先前未登記） | 🔴 |
| **A3** | Supabase Auth → SMTP | 修 SMTP 504 根因，或改 `mailer_autoconfirm` | 新用戶註冊後收不到驗證信，**無法登入**（現況只靠前端友善訊息撐） | 🔴 |
| **A4** | Supabase → Reports | 開每日 email 報告 | 線上異常沒人知道，繼續靠你親自發現 | 🟠 |

> 驗證 A1：執行後走一次真實結帳，跑 SQL 檔末尾的查詢，確認 `total_amount = items_sum`。
> 注意：`reviews_policy_patch.sql` 會 `DROP POLICY IF EXISTS` 覆蓋同名政策。

---

## B 組：需你拍板（我給建議，等你一句話）

| # | 位置（檔案:行） | 現況 | 建議 | 優先 |
|---|---|---|---|---|
| **B1** | 火星 7 頁的 `cosmic-950` / `gold-500` 色票 | 7 頁中 5 頁沒定義 → class 全 fallback，視覺跟宗教區不一致 | 火星改用現有 token（全站一套語言） | 🟠 |
| **B2** | `temple.html:7,155`<br>`monastery.html:7,173`<br>`hall.html:7,182,480`<br>`mars-healing-register.html:728`（GALACTIC HEALING CHAMBER）<br>`holiday-entry.html` hero「星際交響錄」 | 可見文字仍是 GALACTIC GALLERY／星際，違 brief「零 Galactic 殘留」 | 可見文字全改 WAVE ART MALL；色票名 `galactic-purple`（15 檔）改名會動到商城過渡期，建議暫留 | 🟠 |
| **B3** | 火星「2026年7月17日前限定」 | 已過期兩個月仍在收登記 | 撤下優待文案，改常態方案（或給新日期） | 🟠 |
| **B4** | `holiday.html:6`（title）、`:226`（正文） | 「數數數數數量量量量量」 | 全歷史版本一致、無對照 → 維持不動 | 🟡 |
| **B5** | `temple` / `monastery` / `palace` / `hall` | 3 頁 `lang="en"` 英文 demo（CURRENT BID 4.2 ETH 等） | 中文化＋改 NT$，或先從 religion 拿掉連結 | 🟡 |
| **B6** | `holiday-select.html`、`mars-healing-detail.html` | **入站連結數 = 0**（實測），純孤兒 | 接上動線 或 刪除 | 🟡 |
| **B7** | 管理後台 `admin-summary-headquarter` vs `admin-summary` | 同一份資料兩套數字，呈總部版金額較低 | 這是業務決策，需你確認是否刻意 | 🔴 |
| **B8** | 7 個檔的 `ADMIN_EMAILS` | 只有 `2022lingyun@gmail.com` 一個管理員 | 補第二個帳號（見 C3） | 🟠 |

> 逾期規則：B1–B6 若在 **2026-09-24** 未拍板，自動採「建議」欄方案（見 `OPEN-DECISIONS.md`）。

---

## C 組：本地工程，我可直接做（你下令即可）

| # | 位置 | 要改什麼 | 實測現況 | 優先 |
|---|---|---|---|---|
| **C1** | 28 個頁面 | 補 `meta description` + OG 標籤 | **只有 6/34 頁有 `og:title`** | 🟠 |
| **C2** | 25 個頁面 | 補引入 `js/nav.js` | **只有 9 頁有**，其餘無登入狀態、無購物車角標 | 🟠 |
| **C3** | `admin-*.html`×5、`category.html:201,211`、`mars-healing-admin.html:200` | 管理員 email 硬編 **8 處／7 檔** → 集中到單一設定 | 換管理員要改 8 個地方 | 🟠 |
| **C4** | `checkout.html` / `cart.html` | 下單前驗庫存 | **完全沒有庫存檢查**（實測 0 命中） → 超賣風險 | 🟠 |
| **C5** | `checkout.html` vs `supabase-schema.sql` | 核對 `subtotal` / `city` / `district` 欄位定義 | 商城報告列為「需驗證」，尚未結論 | 🟠 |
| **C6** | `living-buddha.html` | 「五術／密宗／奇門」卡片無 onclick | 實測有標題無動作 → 補 onclick 或改 disabled 樣式 | 🟡 |
| **C7** | `admin-summary-headquarter.html`、`admin-roster-headquarter.html` | title 加「（呈總部）」、加「返回內部名冊」按鈕 | 兩版頁面外觀幾乎一樣，容易看錯 | 🟡 |
| **C8** | 管理後台 4 頁 | 抽出共用金額邏輯（消除 98% 重複） | 較大重構，建議併入 D1 一起做 | 🟡 |
| **C9** | 管理後台查詢 | 加 `.limit()` / 分頁 | 全表讀取，資料量大了會慢 | 🟢 |
| **C10** | 28 頁（含 index） | Tailwind Play CDN → 換 `out/rewrite/base/base.css` | 屬 D 組範圍，但也可單獨先做 | 🟢 |

---

## D 組：Phase 3 重寫（24 頁，Q1② 範圍）

| # | 模組 | 頁數 | 開工條件 |
|---|---|---|---|
| **D1** | 管理後台 4 頁 | 4 | **無待決項，可最先開工**（B7 確認後更佳） |
| **D2** | 宗教專區 8 頁 | 8 | 等 B2／B5 |
| **D3** | 火星療癒 7 頁 | 7 | 等 B1／B3 |
| **D4** | 七七地赦／名冊 5 頁 | 5 | 等 B4／B6 |

基座已凍結：`out/rewrite/base/`（base.css 66.9KB + db.js + nav.js + meta.js + CONTRACT.md 七條紅線）。
門禁六條全綠：`npm run gates`。

---

## ✅ 已處理完（不用再管）

| 項目 | 狀態 |
|---|---|
| 字型 20.12MB → 153.3KB | ✅ 已上線 |
| 管理後台 4 頁 noindex | ✅ |
| `review.html` 建置、order-history 斷鏈 | ✅ |
| `product-detail` OG 動態覆寫、living-buddha title | ✅ |
| `pwreset.html` / `order-success.html` / 636MB 影片 / 21MB 字型 | ✅ 已歸檔 |
| 8765 雙行程 | ✅ 實測目前無監聽 |
| 根目錄草稿 `_live_checkout.html` / `_v_checkout_new.html` | ✅ 已清 |
| `assets/videos` 613MB 孤兒 | ✅ 已清 |
| 金流防線 v2（會讓結帳全掛的 v1 缺陷） | ✅ 已修 + `test:money` 11 項斷言 |
| 本地↔線上落差檢查 | ✅ `check:drift` 40/40 一致 |

---

## 怎麼下令

- 「**C 全做**」→ 我按 C1→C10 順序做，每條一 commit，做完跑 `npm run gates`
- 「**C1 C2 C4**」→ 只做指定條目
- 「**D1 開工**」→ 管理後台 4 頁先重寫（無待決項）
- 「**B 全部採建議**」→ 我直接把 B1–B6 按建議欄改掉並 commit（B7 除外，那要你確認）
- A 組只能你自己執行（動線上），我可以把要貼的 SQL 印給你
