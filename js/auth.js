/*
  =========================================================
  auth.js —— 會員登入、權限與回跳的統一工具
  =========================================================
  
  這個模組提供全站統一的：
  - 登入守門（未登入自動導向登入頁並保存回跳）
  - 管理員權限判斷（預留多人角色擴充）
  - 安全回跳（登入成功後依角色分流或回原頁）
  
  使用方式：
  在需要保護的頁面引入此檔案（須先引入 supabaseClient.js）：
    <script src="../js/supabaseClient.js"></script>
    <script src="../js/auth.js"></script>
  
  然後在頁面初始化時呼叫對應守門函式：
    requireMemberLogin()  // 會員歷史頁
    requireAdminLogin()   // 管理頁
*/

// -----------------------------------------------------
// 管理員判斷：統一判斷點，未來可改為角色資料表查詢
// -----------------------------------------------------
// 第一階段：直接比對 Email（與目前 RLS 一致）
// 第二階段：改為查詢 user_roles 資料表
// 注意：此清單必須與 backend/*.sql 中的 RLS 判斷條件一致，
// 修改管理員時務必同步更新 SQL policy，否則前端與資料庫權限會不一致。
const ADMIN_EMAILS = ["2022lingyun@gmail.com"];

/**
 * 判斷指定使用者是否為管理員
 * @param {Object} user - Supabase user 物件
 * @returns {boolean}
 */
function isAdmin(user) {
  if (!user?.email) return false;
  return ADMIN_EMAILS.includes(user.email);
}

// -----------------------------------------------------
// 安全回跳工具
// -----------------------------------------------------
/**
 * 安全保存原頁面網址到 localStorage，供登入成功後回跳
 * 只保存同源且非 auth 頁的網址
 * @param {string} url - 要保存的網址（預設為目前頁面）
 */
function saveRedirectUrl(url = window.location.href) {
  try {
    const targetUrl = new URL(url, window.location.origin);

    // 安全檢查：只允許同源
    if (targetUrl.origin !== window.location.origin) {
      console.warn("[saveRedirectUrl] 拒絕跨域回跳:", url);
      return;
    }

    // 避免回跳到 auth 頁本身造成循環
    const isAuthPage =
      targetUrl.pathname.endsWith("/pages/auth.html") ||
      targetUrl.pathname.endsWith("/auth.html") ||
      targetUrl.pathname === "/pages/auth" ||
      targetUrl.pathname === "/auth";

    if (isAuthPage) {
      console.warn("[saveRedirectUrl] 拒絕回跳到 auth 頁:", url);
      return;
    }

    localStorage.setItem("wave_redirect_after_login", targetUrl.href);
  } catch (e) {
    console.warn("[saveRedirectUrl] 網址格式錯誤:", url, e);
  }
}

/**
 * 登入成功後執行回跳
 * 優先回到原頁；若無原頁則依角色分流
 * @param {Object} user - Supabase user 物件
 */
async function redirectAfterLogin(user) {
  const savedUrl = localStorage.getItem("wave_redirect_after_login");

  // 優先回到原頁
  if (savedUrl) {
    localStorage.removeItem("wave_redirect_after_login");
    try {
      const targetUrl = new URL(savedUrl, window.location.origin);

      // 再次檢查安全性
      if (targetUrl.origin === window.location.origin) {
        const isAuthPage =
          targetUrl.pathname.endsWith("/pages/auth.html") ||
          targetUrl.pathname.endsWith("/auth.html");
        if (!isAuthPage) {
          window.location.href = targetUrl.href;
          return;
        }
      }
    } catch (e) {
      console.warn("[redirectAfterLogin] 回跳網址無效:", savedUrl, e);
    }
  }

  // 無原頁時依角色分流
  if (isAdmin(user)) {
    // 管理員前往管理入口
    window.location.href = getPathTo("pages/admin-roster.html");
  } else {
    // 一般會員前往會員歷史入口
    window.location.href = getPathTo("pages/order-history.html");
  }
}

// -----------------------------------------------------
// 會員頁守門：要求已登入且已驗證 Email
// -----------------------------------------------------
/**
 * 會員歷史頁守門：未登入或未驗證會立即導向登入頁
 * 應在頁面 DOMContentLoaded 時立即呼叫
 * @returns {Promise<Object|null>} 通過時回傳 user 物件；失敗回傳 null
 */
async function requireMemberLogin() {
  const user = await getCurrentUser();

  if (!user) {
    saveRedirectUrl();
    showToast("請先登入才能查看訂單與資料", "error");
    setTimeout(() => {
      window.location.href = getPathTo("pages/auth.html");
    }, 800);
    return null;
  }

  // Email 驗證檢查
  if (!user.email_confirmed_at) {
    saveRedirectUrl();
    showToast("請先到信箱完成 Email 驗證", "error");
    setTimeout(() => {
      window.location.href = getPathTo("pages/auth.html?notice=verify-email");
    }, 1200);
    return null;
  }

  return user;
}

// -----------------------------------------------------
// 管理頁守門：要求已登入、已驗證且為管理員
// -----------------------------------------------------
/**
 * 管理頁守門：未登入、未驗證或非管理員會立即導向對應頁面
 * 應在頁面 DOMContentLoaded 時立即呼叫
 * @returns {Promise<Object|null>} 通過時回傳 user 物件；失敗回傳 null
 */
async function requireAdminLogin() {
  const user = await getCurrentUser();

  if (!user) {
    saveRedirectUrl();
    showToast("請先登入管理員帳號", "error");
    setTimeout(() => {
      window.location.href = getPathTo("pages/auth.html");
    }, 800);
    return null;
  }

  // Email 驗證檢查
  if (!user.email_confirmed_at) {
    saveRedirectUrl();
    showToast("請先到信箱完成 Email 驗證", "error");
    setTimeout(() => {
      window.location.href = getPathTo("pages/auth.html?notice=verify-email");
    }, 1200);
    return null;
  }

  // 管理員權限檢查
  if (!isAdmin(user)) {
    showToast("您沒有管理員權限", "error");
    setTimeout(() => {
      window.location.href = getPathTo("index.html");
    }, 1200);
    return null;
  }

  return user;
}

// -----------------------------------------------------
// 相容說明
// -----------------------------------------------------
// 結帳等操作仍使用 supabaseClient.js 內既有的 requireLogin()，
// 此處不重複定義，避免兩份邏輯分岔維護。
// 若日後要統一，再將 supabaseClient.js 的 requireLogin 改為呼叫
// saveRedirectUrl()，而不是自己內嵌 localStorage 邏輯。
