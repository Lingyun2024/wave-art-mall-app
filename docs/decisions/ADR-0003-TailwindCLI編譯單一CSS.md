# ADR-0003 · 樣式策略：Tailwind CLI 編譯單一 CSS，收斂三套設定

- **狀態**：✅ 已決策 —— **採 A（Tailwind CLI 編譯單一 base.css）**
- **日期**：2026-09-13（Phase 3 開工前拍板）
- **決策者**：族族（三案選 A／推薦案）
- **上游**：`docs/briefs/2026-09-13_網站重寫.md`（已凍結，Q2② 純靜態不打包）
- **影響**：H1 基座的樣式產物、24 頁重寫後的 head 寫法、字型/主題 token 的唯一來源

---

## 背景

實測（2026-09-13）：28/33 頁引 Play CDN，其中 **27 頁內嵌完整 `tailwind.config`**（每頁 90 行重複 token，soft-power.html 與 js/tailwind-config.js 兩份即目視一致），只有 9 頁引用共用的 `js/tailwind-config.js`。這是「三套 Tailwind 配置並存」亂象的實證來源：任何 token 改動要同步 27 處，必然再長出漂移。

## 選項

### A. Tailwind CLI 編譯單一 CSS（✅ 採用）
- 做法：
  1. token 唯一來源收斂為 `out/rewrite/base/tokens.cjs`
  2. `tailwind.config.cjs` 以 content 掃描 24 頁重寫範圍，JIT 產出 `base.css`（含共享元件層：toast / glass-card / gold-frame）
  3. **產出物 commit 進 repo**——部署與本機都是純靜態，不需任何建置步驟，與 Q2② 完全相容（CLI 只在「改 token / 新增工具類」時由開發手動重跑一次）
- 代價：新增用到的工具類時要重跑 CLI（加進 `package.json` 的 `build:css` script 一鍵執行）
- 優點：27 份內嵌 config 一次清空；無 runtime CDN 依賴；檔案可 minify；`<script src="cdn.tailwindcss.com">` 全數移除

### B. 維持 Play CDN
- 代價：runtime 編譯閃爍、inline config 重複無法收斂、三套設定漂移繼續
- 結論：治標不治本

### C. 手寫 token + 少量工具類，捨棄 Tailwind
- 代價：24 頁全部重寫 class 寫法，工作量最大且無收益
- 結論：過度工程

## 決策

採 **A**。商城 9 頁（範圍外）維持 Play CDN 現狀不動，直到其模組輪到重寫。

## 連帶影響

- `js/tailwind-config.js` 降級為「商城 9 頁過渡期專用」，24 頁重寫後即可刪除候選
- `.htmlvalidate.json` / prettier 不需調整；`build` 門禁加「`base.css` 與 tokens 同步」檢查（hash 比對，防改 token 忘記重編）
- 共用元件樣式（toast、glass-card、gold-frame 等原散在 `css/style.css`）收進 base.css 的 `@layer components`，`css/style.css` 同步降級為商城過渡期專用
