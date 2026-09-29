# 內容查證報告（任務 9）

**日期**：2026-09-13 ｜ **範圍**：brief Q1② 的 24 頁重寫範圍（宗教 8 / 火星療癒 7 / 七七地赦 5 / 管理後台 4）＋ index.html 抽查
**方法**：全量 grep（品牌殘留關鍵字、佔位標記、歷史備份對照）；**未改任何文案**（依 brief 角色契約：內容查證不得自行改文案）
**證據行號**均為 2026-09-13 工作樹快照。

---

## 一、新發現（本批查證首次揭露）

### A1. 火星療癒 7 頁使用「第三套設計 token」—— H1 基座的直接衝突 🔴

| 證據 | 位置 |
|---|---|
| 大量 class 引用 `bg-cosmic-950/80`、`border-gold-500/30`、`text-gold-200`、`gold-input-focus` | `pages/mars-healing-register.html` 全表單（約 396–694 行） |
| 僅 6/7 頁有 `tailwind.config`，**其中只有 2 頁定義 cosmic/gold 色票**（register、success） | `grep -l cosmic pages/mars-*.html` 實測 |

**判讀**：`cosmic-950`、`gold-500` 等色名**不存在**於共用 `js/tailwind-config.js`，也未進 H1 `tokens.cjs`。intro/detail/history/admin 4 頁引用未定義的 class，實際渲染全部 fallback 到透明/預設色——這是「火星療癒視覺看起來和宗教區不一樣」的根因。
**處置建議（須拍板）**：

| 方案 | 內容 | 代價 |
|---|---|---|
| A | 把 cosmic/gold 色票併入 H1 tokens.cjs，火星模組續用 | 品牌出現兩套色票語言，token 表膨脹 |
| B | 火星 7 頁重寫時改用現有 token（background/surface/secondary…） | 視覺變動較大，但全站一套語言 |

### A2. temple / monastery / hall 可見品牌殘留「GALACTIC GALLERY」🔴

| 位置 | 證據 |
|---|---|
| `pages/temple.html` | `<title>Galactic Gallery - Temple (廟)</title>`（L7）、頁首大字 `GALACTIC GALLERY`（L155） |
| `pages/monastery.html` | `<title>Galactic Gallery - 寺 Monastery</title>`（L7）、頁首 `GALACTIC GALLERY`（L173） |
| `pages/hall.html` | `<title>Galactic Gallery - Hall</title>`（L7）、頁首 `GALACTIC GALLERY`（L182） |

**判讀**：違反 brief 最終驗收「全站 grep 不到 Galactic／星際殘留」。注意 `galactic-purple` 色票名散見多頁（含 09-12 修復的 soft-power/religion OG），但色票**名**是內部代號、不是可見文案，是否一併改名（→ 例如 `accent-purple`）建議一併拍板。
**推薦**：可見文字統一改 WAVE ART MALL；色票名暫留（改名會動到商城過渡期 9 頁共用的 js/tailwind-config.js，範圍外）。

---

## 二、歷史待決文案（2026-09-12 已列，狀態複核）

| # | 項目 | 狀態 | 證據 / 複核 |
|---|---|---|---|
| P1 | 火星療癒「2026年7月17日前限定請領」 | ⚠️ **截止日已過**（今天 2026-09-13） | `mars-healing-intro.html` L10 og:description、L22 meta description。頁面活動已過期仍在收登記 |
| P2 | holiday「數數數數數量量量量量」疊字 | ⚠️ 維持待決 | `holiday.html` L6 title、L309 內文。全歷史版本一致（2026-09-12 查證），無對照可斷定為誤 |
| P3 | 宮/廟/寺/堂英文 demo | ✅ 本次複查無發現 | holiday 5 頁 + admin 4 頁 grep 無可見英文 demo（僅 temple/monastery 的 title 殘留，歸 A2） |
| P4 | 「執執登記名冊」 | ✅ 不動 | 2026-09-12 已查證為用戶主動改名（`_local_backup/MD_SP/造新字.md`） |

---

## 三、佔位 / demo 內容清單（重寫時須填真內容或刪）

| 位置 | 內容 | 判讀 |
|---|---|---|
| `monastery.html` L338 | `<!-- Card 3 (Placeholder for Grid layout demonstration) -->` | 展示卡位 3 是佔位 |
| `monastery.html` L389 | `<!-- Card 4 (Placeholder for Grid layout demonstration) -->` | 展示卡位 4 是佔位 |
| `palace.html` L319 | `<!-- Artifact Card 3 (Placeholder for layout demonstration) -->` | 文物卡位 3 是佔位 |
| `mars-healing-register.html` | 表單 placeholder 文字屬正常 UX 提示（「請輸入全名」等） | ✅ 不算殘留 |

## 四、品牌殘留複查（乾淨項）

- 「咖啡 / coffee」：24 頁 + index **零命中**（2026-09-12 已修 living-buddha title，複查確認無復發）
- holiday 5 頁 + admin 4 頁：無 Galactic、無星際、無英文 demo 可見文字

---

## 五、給主理人的待拍板清單

1. **A1**：火星 cosmic/gold 色票 —— 併入 H1 token（A）還是火星重寫改用現有 token（B）？
2. **A2**：「GALACTIC GALLERY」可見文字 —— 重寫時統一改 WAVE ART MALL？（色票名是否一併改名另議）
3. **P1**：7/17 已過期 —— 撤下優待文案（A）／改新截止日（B，須給日期）／維持（C）？
4. **P2**：holiday 疊字 —— 維持（2026-09-12 傾向）或當錯字修？

> 以上四項都**不是**內容查證角色可自決的，依規範第 4 節送人工拍板。
