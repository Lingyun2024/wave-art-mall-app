# Auth 統一守門與回跳 · 接口設計

STATUS: DRAFT

設計日期：2026-09-30
對應 Brief：`docs/briefs/2026-09-30_會員登入與權限入口全盤規劃-v1-draft.md`

## 1. 設計目標

建立全網站統一的登入守門、權限判斷與安全回跳機制，讓所有受保護頁面使用相同方式處理未登入、未驗證、無權限的情境。

## 2. 模組位置

- 檔案：`js/auth.js`
- 依賴：`js/supabaseClient.js`（必須先載入）
- 提供：`isAdmin()`、`saveRedirectUrl()`、`redirectAfterLogin()`、`requireMemberLogin()`、`requireAdminLogin()`

## 3. 接口契約

### 3.1 isAdmin(user)

**用途**：判斷指定使用者是否為管理員。

**輸入**：
- `user`：Supabase user 物件，或 null / undefined。

**輸出**：
- `true`：使用者 Email 位於 `ADMIN_EMAILS` 清單。
- `false`：未登入、無 Email、或 Email 不在清單。

**禁止動作**：
- 不直接讀取 DOM。
- 不執行網路請求。
- 不在前端洩露管理員清單以外的個資。

**完成定義**：
- 輸入 null / undefined / 無 email 回傳 false。
- 輸入符合清單的 email 回傳 true。
- 清單集中維護，與 RLS 政策使用的 Email 一致。

---

### 3.2 saveRedirectUrl(url)

**用途**：安全保存原頁面網址到 localStorage，供登入成功後回跳。

**輸入**：
- `url`：可選字串。預設為 `window.location.href`。

**輸出**：
- 無回傳值。
- 成功時寫入 `localStorage.wave_redirect_after_login`。
- 失敗時記錄 warning 到 console，不拋出例外。

**安全規則**：
- 只允許同源網址（與 `window.location.origin` 相同）。
- 禁止回跳到 Auth 頁本身（`/pages/auth.html`、`/auth.html`），避免循環。
- 禁止 `javascript:`、外部網域、無效 URL。

**禁止動作**：
- 不保存跨域 URL。
- 不保存 Auth 頁本身的網址。
- 不保存無法解析的字串。

**完成定義**：
- 合法同源非 Auth 頁網址成功寫入 localStorage。
- 非法 URL 不寫入、不拋出例外、console 有 warning。

---

### 3.3 redirectAfterLogin(user)

**用途**：登入成功後執行回跳。

**輸入**：
- `user`：Supabase user 物件（已確認登入成功）。

**輸出**：
- 無回傳值。
- 成功時執行 `window.location.href` 跳轉。

**回跳優先順序**：
1. 若 `localStorage.wave_redirect_after_login` 有值且合法，跳回原頁，並清除該值。
2. 若無回跳值或回跳值無效，依角色分流：
   - 管理員（`isAdmin(user) === true`）：前往 `pages/admin-roster.html`。
   - 一般會員：前往 `pages/order-history.html`。

**安全規則**：
- 再次檢查回跳網址同源。
- 再次檢查不跳回 Auth 頁。

**禁止動作**：
- 不保留回跳值超過一次使用。
- 不在回跳前執行任何業務操作。

**完成定義**：
- 有合法回跳值時正確跳轉。
- 無回跳值時依角色正確分流。
- 跳轉後 localStorage 不再保留回跳值。

---

### 3.4 requireMemberLogin()

**用途**：會員歷史頁守門。未登入或未驗證會立即導向登入頁並保存回跳。

**輸入**：
- 無參數。呼叫前需確保已載入 `supabaseClient.js`。

**輸出**：
- `user` 物件：通過檢查時回傳。
- `null`：未登入或未驗證時回傳，並已執行導向。

**行為**：
1. 呼叫 `getCurrentUser()` 取得目前使用者。
2. 若未登入：
   - 呼叫 `saveRedirectUrl()` 保存目前頁網址。
   - 顯示 Toast：「請先登入才能查看訂單與資料」。
   - 800ms 後導向 `pages/auth.html`。
   - 回傳 null。
3. 若未驗證 Email：
   - 呼叫 `saveRedirectUrl()` 保存目前頁網址。
   - 顯示 Toast：「請先到信箱完成 Email 驗證」。
   - 1200ms 後導向 `pages/auth.html?notice=verify-email`。
   - 回傳 null。
4. 若已登入且已驗證：
   - 回傳 user 物件。

**禁止動作**：
- 不檢查管理員權限。
- 不修改 DOM（Toast 除外）。
- 不執行任何資料查詢。

**完成定義**：
- 未登入與未驗證情境正確導向並保存回跳。
- 已登入且已驗證時正確回傳 user。
- 不阻斷已驗證會員的正常流程。

---

### 3.5 requireAdminLogin()

**用途**：管理頁守門。未登入、未驗證或非管理員會立即導向對應頁面。

**輸入**：
- 無參數。呼叫前需確保已載入 `supabaseClient.js`。

**輸出**：
- `user` 物件：通過全部檢查時回傳。
- `null`：任一檢查失敗時回傳，並已執行導向。

**行為**：
1. 呼叫 `getCurrentUser()` 取得目前使用者。
2. 若未登入：
   - 呼叫 `saveRedirectUrl()` 保存目前頁網址。
   - 顯示 Toast：「請先登入管理員帳號」。
   - 800ms 後導向 `pages/auth.html`。
   - 回傳 null。
3. 若未驗證 Email：
   - 呼叫 `saveRedirectUrl()` 保存目前頁網址。
   - 顯示 Toast：「請先到信箱完成 Email 驗證」。
   - 1200ms 後導向 `pages/auth.html?notice=verify-email`。
   - 回傳 null。
4. 若非管理員（`isAdmin(user) === false`）：
   - 顯示 Toast：「您沒有管理員權限」。
   - 1200ms 後導向 `index.html`。
   - 回傳 null。
5. 若全部通過：
   - 回傳 user 物件。

**禁止動作**：
- 不允許非管理員進入管理頁。
- 不修改 DOM（Toast 除外）。
- 不執行任何資料查詢。

**完成定義**：
- 未登入、未驗證、非管理員三種情境正確導向。
- 管理員正確回傳 user。
- 非管理員無法繞過守門取得資料。

---

## 4. 使用方式

### 4.1 會員歷史頁

```html
<script src="../js/supabaseClient.js"></script>
<script src="../js/auth.js"></script>
<script>
  document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireMemberLogin();
    if (!user) return; // 已自動導向
    
    // 此處可安全執行會員資料查詢
    await loadMemberData(user);
  });
</script>
```

### 4.2 管理頁

```html
<script src="../js/supabaseClient.js"></script>
<script src="../js/auth.js"></script>
<script>
  document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireAdminLogin();
    if (!user) return; // 已自動導向
    
    // 此處可安全執行管理資料查詢
    await loadAdminData(user);
  });
</script>
```

### 4.3 Auth 頁登入成功後

```html
<script src="../js/supabaseClient.js"></script>
<script src="../js/auth.js"></script>
<script>
  async function handleLoginSuccess() {
    const user = await getCurrentUser();
    if (!user) return;
    
    await redirectAfterLogin(user);
  }
</script>
```

---

## 5. 與現有程式的相容性

### 5.1 supabaseClient.js 的 requireLogin()

- `supabaseClient.js` 原有的 `requireLogin()` 仍被結帳等操作使用。
- `auth.js` 不重複定義 `requireLogin()`，避免兩份邏輯分岔。
- 後續可將 `supabaseClient.js` 的 `requireLogin()` 改為呼叫 `saveRedirectUrl()`，而不是自己內嵌 localStorage 邏輯。

### 5.2 各頁面舊有的守門寫法

以下頁面原本各自實作守門邏輯，本次統一改用 `auth.js`：

| 頁面 | 舊寫法 | 新寫法 |
|---|---|---|
| `order-history.html` | `getCurrentUser()` + 顯示訪客區塊 | `requireMemberLogin()` |
| `mars-healing-history.html` | `getCurrentUser()` + 顯示訪客區塊 | `requireMemberLogin()` |
| `mars-healing-admin.html` | 自行檢查 `getUser()` 與 Email | `requireAdminLogin()` |
| `admin-mars-healing.html` | 自行檢查 `getCurrentUser()` 與 ADMIN_EMAIL | `requireAdminLogin()` |
| `admin-roster.html` | 自行檢查 `getCurrentUser()` 與 ADMIN_EMAILS | `requireAdminLogin()` |
| `admin-roster-headquarter.html` | 自行檢查 `getCurrentUser()` 與 ADMIN_EMAILS | `requireAdminLogin()` |
| `admin-summary.html` | 自行檢查 `getCurrentUser()` 與 ADMIN_EMAILS | `requireAdminLogin()` |
| `admin-summary-headquarter.html` | 顯示提示但不導向 | `requireAdminLogin()` |

### 5.3 ADMIN_EMAILS 清單

- 集中定義於 `auth.js`。
- 初始值：`["2022lingyun@gmail.com"]`。
- 必須與 `backend/*.sql` 中的 RLS 判斷條件一致。
- 未來可改為查詢 `user_roles` 資料表或 JWT custom claims。

---

## 6. 錯誤處理

| 錯誤情境 | 預期行為 |
|---|---|
| `supabaseClient.js` 未載入 | `getCurrentUser()` 拋錯；呼叫端應在載入順序確保正確 |
| localStorage 不可用 | `saveRedirectUrl()` 記錄 warning，不阻斷流程 |
| 回跳網址格式錯誤 | 不跳轉，依角色分流到預設頁 |
| Session 過期 | `getCurrentUser()` 回傳 null，導向登入頁 |

---

## 7. 待確認事項

- [ ] 管理員預設目的地是否為 `admin-roster.html`。
- [ ] 一般會員預設目的地是否為 `order-history.html`。
- [ ] `admin-summary-headquarter.html` 原本不導向是否為刻意設計。
- [ ] 是否需要在 `auth.js` 提供統一的登出函式。
