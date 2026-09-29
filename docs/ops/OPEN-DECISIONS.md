# 懸而未決登記冊 · WAVE ART MALL

> 疊加自《虛擬團隊運營手冊_擴展版》＋ 專家團 OPEN-DECISIONS 規範
> 鐵律：只追加 + 就地關閉（OPEN → RESOLVED，補 Resolution 欄）

---

## 當前狀態

**4 項未決（OPEN）／ 0 項已決**

---

## 登記表

| Date | Source | Open Item | Related Constraints | Current Leaning | Blocked By | Resolves When | Status |
|---|---|---|---|---|---|---|---|
| 2026-09-13 | content-audit A1 | 火星療癒 7 頁的 cosmic/gold 第三套色票如何處置 | 5 頁未定義 class 全 fallback；併入 token 會讓 token 表變大 | 傾向 B：火星改用現有 token | 等族族拍板 | 拍板或 2026-09-24 逾期採 B | OPEN |
| 2026-09-13 | content-audit A2 | temple/monastery/hall 可見的「GALACTIC GALLERY」文字 | 違 brief 驗收「零 Galactic 殘留」；色票名 galactic-purple 改名會動商城過渡期 9 頁 | 傾向 ①：可見文字全改 WAVE ART MALL，色票名暫留 | 等族族拍板 | 拍板或 2026-09-24 逾期採 ① | OPEN |
| 2026-09-13 | content-audit P1 | 火星「2026年7月17日前限定」已過期兩個月仍在收登記 | 涉及對外承諾與收款，改文案前需確認實際方案 | 傾向 ①：撤下優待文案改常態方案 | 等族族確認實際方案 | 拍板或 2026-09-24 逾期採 ① | OPEN |
| 2026-09-13 | content-audit P2 | holiday「數數數數數量量量量量」疊字是否為錯字 | 全歷史版本一致，無對照可證實 | 傾向 ①：維持不動（視為刻意用法） | 等族族確認 | 拍板或 2026-09-24 逾期採 ① | OPEN |

---

## 工程側待辦（非業務決策，可自行推進）

> 註：工程側待辦標 `TODO`（我方自行推進），不算入人工介入率；只有 `OPEN`（卡在等族族）才計入。

| Date | Source | Item | Blocked By | Status |
|---|---|---|---|---|
| ~~2026-09-22~~ | ~~RISK-REGISTER R2~~ | ~~補一條金流 e2e~~ | ✅ **RESOLVED 2026-09-22**：`tools/test_money_guard.mjs`（PGlite 離線實測，七情境 11 項斷言全綠），已納 `npm run gates`；實測中抓出 v1 致命缺陷並修為 v2 | — | RESOLVED |
| 2026-09-22 | RISK-REGISTER R8 | 執行 `backend/order_amount_guard.sql`（v2）到 Supabase | ⚠️ 需族族在 SQL Editor 執行（動線上）；未執行前商城訂單無金額防線 | 建議：儘速執行，執行後走一次真實結帳驗證 | 等族族執行 | OPEN |
| 2026-09-22 | RISK-REGISTER R9 | 執行 `backend/reviews_policy_patch.sql` 到 Supabase | ⚠️ 需族族在 SQL Editor 執行（動線上） | 建議：與 A1 同批執行；注意會 `DROP POLICY IF EXISTS` 覆蓋同名政策 | 等族族執行 | OPEN |
| 2026-09-22 | RISK-REGISTER R1 | Supabase SMTP 根因修復 | ⚠️ 需族族放行（動線上） | OPEN |
| 2026-09-22 | RISK-REGISTER R7 | 銀行帳號曾進本地 git 歷史（52137f3／73c41f6），是否清歷史 | **2026-09-22 實測：線上 9 頁零命中帳號／渣打／大直分行，修正文案已上線 → 對外無暴露**；且上線走 Vercel CLI 非 push | 傾向：暫不清（對外已無風險） | — | **push 任何遠端之前** | OPEN（低） |

---

## 關閉規則

1. 拍板 → 就地改 `Status: RESOLVED` + 補 `Resolution` 欄，**原列不刪**
2. 逾期（2026-09-24）→ 採 Current Leaning，標 `RESOLVED (auto-adopted)`
3. 已關閉且影響架構者 → 升格為 `docs/decisions/ADR-000X`
