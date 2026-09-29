# 斷點恢復方案 · WAVE ART MALL

> 疊加自《虛擬團隊運營手冊_擴展版》§五
> 版本：v1.0（2026-09-22）

---

## 一、現有斷點能力盤點（本站其實已有不少）

| 能力 | 本站載體 | 判定 |
|---|---|---|
| 版本快照 | git（4+ commits：修復 → brief 凍結 → 門檻 → H1 基座） | ✅ |
| 檔案歸檔 | `backups/`（含 `2026-09-12_pre_fix/`）、`_restore_backup/` | ✅ |
| 線上快照 | `_online_snapshot/`、`_online_source/` | ✅ |
| 狀態機 | `docs/board.md`（任務／狀態／等待什麼／產物） | ✅ |
| 基線 | `docs/baseline-2026-09-13.md`（什麼是綠的） | ✅ |
| 基座版本 | `out/rewrite/base/` + `.sources.sha256` | ✅ |
| 角色定義版本化 | 無 | 🔴 本次補 |
| 遷移包清單 | 無 | 🟡 本次補 |

---

## 二、角色／基座備份（本次補）

> 本站的「角色」＝共享基座四件套（nav / db / meta / tokens）

```
備份單位：out/rewrite/base/
  每次 CONTRACT 或 tokens 變更，必須 commit 並在 board.md 記版本號

版本標記格式（寫進 CONTRACT.md 頂部）：
  base_version: v1.0 (2026-09-13, commit 2549af0)

回滾指令：
  git checkout <commit> -- out/rewrite/base/
  npm run build:css   # 重編
  npm run gates       # 驗
```

---

## 三、專案遷移包清單（本次補）

```
遷移包必含：
□ pages/（34 頁）+ index.html
□ js/ css/ assets/（字型已子集化）
□ out/rewrite/base/（共享基座 + CONTRACT.md）
□ tools/ tests/ playwright.config.mjs
□ package.json + package-lock.json（含 tailwindcss@3）
□ backend/*.sql（RLS / trigger / policy）
□ docs/（board / decisions / content-audit / ops / baseline）
□ .gitignore（確認排除大檔與敏感檔）

遷移後必跑：
  npm install
  npm run build:css
  npm run gates        # 五門檻全綠才算搬成功
```

---

## 四、總控失效接管（本次補）

> 本站的「總控」＝ AI 協調流程。失效時族族手動接管的讀取順序：

```
1. docs/board.md          → 現在在哪一 Phase、哪些任務卡住
2. docs/ops/OPEN-DECISIONS.md → 卡住的原因是等誰拍板
3. docs/ops/EXCEPTION-RUNBOOK.md → 若是異常，查對應劇本
4. docs/baseline-2026-09-13.md  → 什麼叫做「修好了」
5. 修完：npm run gates 全綠 → commit
```

**接管三不**：
- 不為讓門檻變綠而註解測試
- 不在沒查證的情況下改內容正本
- 未經族族放行，不碰線上（Vercel / Supabase Dashboard）

---

## 五、常見斷點恢復劇本

| 斷點情境 | 恢復指令 / 動作 |
|---|---|
| 改壞某頁 | `git checkout HEAD -- pages/<頁>.html` |
| 改壞基座 | `git checkout <base_commit> -- out/rewrite/base/` → `npm run build:css` → `npm run gates` |
| 線上版與本地不一致 | `npm run check:drift`（只讀，列出哪些檔不同）→ 確認權威端（通常本地是新）→ 重新 `vercel deploy` |
| 部署後發現壞了 | Vercel Dashboard → Deployments → 上一版 Promote / 或本地 `git checkout <commit>` 後重deploy |
| 門檻突然全紅 | 先 `git status` 看是否誤動到設定檔；再看 EXCEPTION-RUNBOOK 劇本 B／C |
| 字型渲染變豆腐 | 確認是否誤用 base64 內嵌 → 改回外連 `url(./字型.ttf)`（見既有鐵律） |

### 部署途徑（重要，別搞混）

```
本地工作區 ──vercel deploy（CLI 直接上傳檔案）──> wave-art-mall.vercel.app
                                                  （projectId prj_8YJu...，outputDirectory "."）

本地 git  ──（無遠端，從不 push）──> 無
Supabase ──（獨立：SQL Editor 手動執行 / Dashboard 設定）
```

- **上線不走 git**：改了檔案不會自動上線，也不會因為 commit 而上線
- **驗證是否同步**：`npm run check:drift`（40 檔 sha256 比對；只讀，不觸發部署）
- **SQL 類的防線不在部署範圍內**，必須另外去 Supabase SQL Editor 執行（見 OPEN-DECISIONS）
- 實測（2026-09-22）：本地 ↔ 線上 40 檔完全一致
