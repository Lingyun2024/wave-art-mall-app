/*
  =========================================================
  db.js —— 全站唯一資料存取層（H1 凍結，ADR-0004）
  =========================================================
  契約重點（評審必查）：
  1. 全站只有這一個 createClient 實例；頁面內出現 createClient 字樣 = 退件
  2. 頁面透過 window.WAVE.db 取用 client 與工具函式
  3. 所有使用者輸入渲染前必過 escapeHtml（brief 第 2 節安全約束）

  歷史：本檔邏輯承繼 js/supabaseClient.js（2026-09-12 修復批次驗證過
  的版本），介面收斂為 window.WAVE 單一命名空間。
*/

// -----------------------------------------------------
// Supabase 連線（唯一實例）
// -----------------------------------------------------
const SUPABASE_URL = "https://tfyxaesejdfxykdalcsj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Sa-csa_ReGMUprDwE1eNow_vtXyYfH0";

// window.supabase 由 CDN SDK 提供（頁面 head 必須先引入 @supabase/supabase-js@2）
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -----------------------------------------------------
// Toast 提示（取代 alert）
// -----------------------------------------------------
function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "toast " + (type === "error" ? "toast-error" : "toast-success");
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// -----------------------------------------------------
// 取得目前登入使用者；未登入回傳 null
// -----------------------------------------------------
async function getCurrentUser() {
  try {
    const { data, error } = await client.auth.getUser();
    if (error) return null;
    return data.user || null;
  } catch (err) {
    console.error("[getCurrentUser] 取得使用者資訊失敗:", err);
    return null;
  }
}

// -----------------------------------------------------
// 檢查登入狀態；未登入或未驗證 Email 就導向登入頁
// -----------------------------------------------------
async function requireLogin(redirectBackUrl) {
  const user = await getCurrentUser();
  if (!user) {
    const backUrl = redirectBackUrl || window.location.href;
    localStorage.setItem("wave_redirect_after_login", backUrl);
    showToast("請先登入才能進行這個操作", "error");
    setTimeout(() => {
      window.location.href = getPathTo("pages/auth.html");
    }, 800);
    return null;
  }

  // 帳號必須完成 Email 驗證才能下單/寫入
  if (!user.email_confirmed_at) {
    const backUrl = redirectBackUrl || window.location.href;
    localStorage.setItem("wave_redirect_after_login", backUrl);
    showToast("請先到 Email 信箱完成驗證，才可以下單", "error");
    setTimeout(() => {
      window.location.href = getPathTo("pages/auth.html?notice=verify-email");
    }, 1200);
    return null;
  }

  return user;
}

// -----------------------------------------------------
// 路徑工具：依目前頁面層級組出正確相對路徑（ADR-0002 契約的一部分）
// -----------------------------------------------------
function getPathTo(targetPathFromRoot) {
  const isInPagesFolder = window.location.pathname.includes("/pages/");
  if (isInPagesFolder) {
    if (targetPathFromRoot.startsWith("pages/")) {
      return targetPathFromRoot.replace("pages/", "");
    }
    return "../" + targetPathFromRoot;
  }
  return targetPathFromRoot;
}

// -----------------------------------------------------
// 查詢參數工具
// -----------------------------------------------------
function getQueryParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

// -----------------------------------------------------
// 顯示工具：價格格式化 / HTML 跳脫（防 XSS，brief 安全約束）
// -----------------------------------------------------
function formatPrice(price) {
  const num = Number(price) || 0;
  return "NT$ " + num.toLocaleString("zh-TW");
}

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

// -----------------------------------------------------
// 導出的單一命名空間（頁面一律用 window.WAVE.*）
// -----------------------------------------------------
window.WAVE = {
  db: client,
  showToast,
  getCurrentUser,
  requireLogin,
  getPathTo,
  getQueryParam,
  formatPrice,
  escapeHtml,
};
