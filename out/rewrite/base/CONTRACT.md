# H1 共享基座契約

**STATUS: FROZEN — 2026-09-13，依族族拍板之 ADR-0002 / 0003 / 0004 建立**

> 本檔凍結後只讀；任何修改必須另開 `_v2.md` 並通知四個頁面模組（宗教 / 火星療癒 / 七七地赦 / 管理後台）。
> 上游：`docs/briefs/2026-09-13_網站重寫.md`（FROZEN）＋ `docs/decisions/ADR-0002~0004`（已決策）。

---

## 0. 每頁固定四件套（ADR-0002 MPA 的落地寫法）

24 頁重寫範圍的每個 html，`<head>` 依序引入：

```html
<!-- 1. 字型（Google Fonts，保持既有三家族） -->
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500&family=Manrope:wght@400&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />
<!-- 2. icon font -->
<link rel="stylesheet" href="../css/material-symbols.css" />
<!-- 3. 基座樣式（Tailwind 編譯產物，禁止再引 cdn.tailwindcss.com） -->
<link rel="stylesheet" href="../out/rewrite/base/base.css" />
<!-- 4. Supabase SDK + 基座 JS（順序不可換） -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../out/rewrite/base/db.js"></script>
<script src="../out/rewrite/base/meta.js"></script>
<script src="../out/rewrite/base/nav.js"></script>
```

`<body>` 內導覽掛點：

```html
<header id="site-header"></header>
<!-- 手機版才需要 -->
<nav id="site-bottom-nav"></nav>
```

---

## 1. 評審必退項（紅線）

| # | 紅線 | 依據 |
|---|---|---|
| R1 | 頁面內出現 `createClient` 字樣 | ADR-0004：唯一實例在 db.js |
| R2 | 引入 `cdn.tailwindcss.com` 或內嵌 `tailwind.config` | ADR-0003：27 份內嵌 config 是亂象根源 |
| R3 | 自刻導覽列（未用 `#site-header` 掛點） | nav.js 契約第 2 條 |
| R4 | 缺 `meta description` 或任一 `og:*` 欄位 | brief 最終驗收第 6 條 |
| R5 | 使用者輸入未過 `WAVE.escapeHtml()` 直接渲染 | brief 安全約束（防 XSS） |
| R6 | 前端計算金額入庫 | brief 安全約束（金額由 DB 計算，`backend/order_amount_guard.sql`） |
| R7 | 用 localStorage 傳業務資料 | ADR-0002 連帶影響（唯一例外：`wave_redirect_after_login`） |

---

## 2. 基座檔案清單與職責

| 檔案 | 職責 | 改動時機 |
|---|---|---|
| `tokens.cjs` | 設計 token 唯一來源（色票/字體/圓角/間距） | 改品牌視覺時；**改完必重跑 `npm run build:css`** |
| `tailwind.config.cjs` | v3 編譯設定；content 只掃 24 頁 | 重寫範圍增減頁時 |
| `src/input.css` | 編譯輸入；共享元件層（toast/glass-card/gold-frame/導覽/spinner/星評） | 新增共享元件樣式時 |
| `base.css` | **編譯產物，commit 進 repo，手動改 = 退件** | 只由 `npm run build:css` 生成 |
| `db.js` | 唯一 createClient + auth 檢查 + 工具函式（`window.WAVE`） | RLS / 表結構變動（連動 H2 資料契約） |
| `nav.js` | 導覽列渲染 + 登入狀態 + 登出 | H3 連結圖凍結後填 `WAVE_NAV_ITEMS` |
| `meta.js` | `applyMeta` / `applyOpenGraph` | OG 欄位需求變動時 |

---

## 3. 凍結事項（本次明確「不做」）

- 不動商城 9 頁：過渡期繼續用 `js/supabaseClient.js` + `js/tailwind-config.js` + `css/style.css`（gallery-* 段），與基座**互相禁止 import**
- `WAVE_NAV_ITEMS` 留空：全站導覽項目待 H3 連結圖拍板後啟用，各模組首頁自訂模組內導覽
- base.css 不掃商城頁 class：content 只列 24 頁，保持產物最小

---

## 4. 驗收

- [x] tokens 與 js/tailwind-config.js 交叉一致（逐鍵比對，值未更動）
- [x] components 層與 css/style.css 全站共用段一致（2026-09-13 快照）
- [ ] `npm run build:css` 產出 base.css 且 `npm run build` hash 檢查通過
- [ ] prettier 格式化通過（`npm run lint`）
