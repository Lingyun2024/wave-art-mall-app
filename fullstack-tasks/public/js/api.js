/*
  =========================================================
  api.js —— 前端 API 客戶端（沿用範本的全域函式風格）
  =========================================================
  職責：
   1. 統一管理 Base URL（同-origin 優先，file:// 開檔時自動指到 localhost:4000）
   2. 自動帶上 access token；401 時用 refresh token 換發後重試一次
   3. 重試策略：4xx 不重試、5xx 與網路錯誤自動重試最多 3 次（指數退避）
   4. 把後端的錯誤碼映射成使用者看得懂的中文訊息
   5. fetch 失敗（伺服器連不上）顯示離線提示

  憑證存放策略：
   - access token：只放在記憶體（變數），重刷頁面即失效，降低 XSS 風險
   - refresh token：放在 sessionStorage（分頁關閉即清除）
   - 正式環境建議改為：refresh token 存 httpOnly Cookie，由後端寫入
*/
(function () {
  "use strict";

  var ACCESS_TOKEN = null; // 只存在記憶體
  var REFRESH_KEY = "ft_refresh_token";

  function resolveBase() {
    var meta = document.querySelector('meta[name="api-base"]');
    if (meta && meta.content) return meta.content.replace(/\/$/, "");
    if (location.protocol === "file:") return "http://localhost:4000";
    return ""; // 同源（Express 同時伺服前端與 API）
  }
  var API_BASE = resolveBase();

  // ---- 錯誤碼 → 中文訊息對照表 ----
  var MESSAGES = {
    VALIDATION_ERROR: "輸入資料有誤，請檢查後再試",
    BAD_REQUEST: "請求格式有問題，請重新操作",
    EMAIL_TAKEN: "這個 Email 已經註冊過了",
    INVALID_CREDENTIALS: "Email 或密碼錯誤",
    MISSING_TOKEN: "請先登入",
    TOKEN_INVALID: "登入已過期，請重新登入",
    REFRESH_TOKEN_REUSED: "偵測到異常登入，請重新登入",
    ACCOUNT_DISABLED: "此帳號已被停用",
    FORBIDDEN: "權限不足，無法執行此操作",
    NOT_FOUND: "找不到資料",
    CONFLICT: "資料衝突，請重新整理後再試",
    INTERNAL_ERROR: "伺服器忙碌中，請稍後再試",
  };

  function messageFor(code, fallback) {
    return MESSAGES[code] || fallback || "發生未知錯誤，請稍後再試";
  }

  // ---- Toast（沿用範本的提示風格）----
  function toast(message, type) {
    var container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "fixed top-4 right-4 z-50 flex flex-col gap-2";
      document.body.appendChild(container);
    }
    var el = document.createElement("div");
    var base = "px-4 py-3 rounded-lg text-sm shadow-lg border transition-opacity duration-300";
    var tone =
      type === "error"
        ? "bg-error-container text-on-error-container border-error"
        : type === "info"
          ? "bg-surface-container-high text-on-surface border-outline-variant"
          : "bg-secondary-container text-on-secondary border-secondary-fixed";
    el.className = base + " " + tone;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      setTimeout(function () {
        el.remove();
      }, 300);
    }, 3000);
  }

  function setTokens(accessToken, refreshToken, remember) {
    ACCESS_TOKEN = accessToken || null;
    if (refreshToken) {
      try {
        // 預設用 sessionStorage；若有勾選「記住我」才用 localStorage
        (remember ? window.localStorage : window.sessionStorage).setItem(REFRESH_KEY, refreshToken);
      } catch (e) {
        /* 隱私模式下可能寫入失敗，忽略 */
      }
    }
  }

  function getRefreshToken() {
    try {
      return (
        window.sessionStorage.getItem(REFRESH_KEY) || window.localStorage.getItem(REFRESH_KEY) || null
      );
    } catch (e) {
      return null;
    }
  }

  function clearTokens() {
    ACCESS_TOKEN = null;
    try {
      window.sessionStorage.removeItem(REFRESH_KEY);
      window.localStorage.removeItem(REFRESH_KEY);
    } catch (e) {
      /* 忽略 */
    }
  }

  function isAuthed() {
    return Boolean(ACCESS_TOKEN) || Boolean(getRefreshToken());
  }

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  /**
   * 核心請求函式
   * @returns {Promise<{ok: boolean, status: number, data: object|null, code: string|null, message: string}>}
   */
  async function request(path, options) {
    options = options || {};
    var method = (options.method || "GET").toUpperCase();
    var url = API_BASE + path;
    var maxAttempts = options.retry === false ? 1 : 3;
    var lastErr = null;

    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      var headers = { "Content-Type": "application/json" };
      if (ACCESS_TOKEN) headers["Authorization"] = "Bearer " + ACCESS_TOKEN;

      var res;
      try {
        res = await fetch(url, {
          method: method,
          headers: headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
      } catch (e) {
        lastErr = { status: 0, code: "NETWORK_ERROR", message: "連不上伺服器，請確認服務是否啟動" };
        if (attempt < maxAttempts) {
          await sleep(300 * attempt);
          continue;
        }
        toast(lastErr.message, "error");
        return { ok: false, status: 0, data: null, code: "NETWORK_ERROR", message: lastErr.message };
      }

      // 401 且尚未嘗試過刷新 → 換發憑證後重試一次
      if (res.status === 401 && !options._retried && getRefreshToken()) {
        var refreshed = await refreshSession();
        if (refreshed) {
          options._retried = true;
          attempt -= 1; // 刷新成功不算一次失敗嘗試
          continue;
        }
        clearTokens();
        redirectToLogin();
        return { ok: false, status: 401, data: null, code: "TOKEN_INVALID", message: messageFor("TOKEN_INVALID") };
      }

      var text = await res.text();
      var data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        data = null;
      }

      if (res.ok) return { ok: true, status: res.status, data: data, code: null, message: "" };

      // 5xx 才重試，4xx 視為使用者的問題，不重試
      if (res.status >= 500 && attempt < maxAttempts) {
        await sleep(300 * attempt);
        continue;
      }

      var code = (data && data.error && data.error.code) || "UNKNOWN";
      var message = messageFor(code, data && data.error && data.error.message);
      return { ok: false, status: res.status, data: data, code: code, message: message };
    }

    return {
      ok: false,
      status: lastErr ? lastErr.status : 0,
      data: null,
      code: lastErr ? lastErr.code : "UNKNOWN",
      message: lastErr ? lastErr.message : "發生未知錯誤",
    };
  }

  async function refreshSession() {
    var token = getRefreshToken();
    if (!token) return false;
    try {
      var res = await fetch(API_BASE + "/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: token }),
      });
      if (!res.ok) return false;
      var data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch (e) {
      return false;
    }
  }

  function redirectToLogin(returnTo) {
    var back = returnTo || location.pathname.split("/").pop() || "index.html";
    location.href = "login.html?next=" + encodeURIComponent(back);
  }

  // ---- 語意化封裝 ----
  var API = {
    base: API_BASE,
    toast: toast,
    messageFor: messageFor,
    setTokens: setTokens,
    clearTokens: clearTokens,
    isAuthed: isAuthed,
    refreshSession: refreshSession,
    redirectToLogin: redirectToLogin,
    request: request,

    auth: {
      register: function (payload) {
        return request("/api/auth/register", { method: "POST", body: payload });
      },
      login: function (payload, remember) {
        return request("/api/auth/login", { method: "POST", body: payload, retry: false }).then(function (r) {
          if (r.ok) setTokens(r.data.accessToken, r.data.refreshToken, remember);
          return r;
        });
      },
      logout: function () {
        var token = getRefreshToken();
        var p = token ? request("/api/auth/logout", { method: "POST", body: { refreshToken: token } }) : Promise.resolve(null);
        return p.finally(function () {
          clearTokens();
        });
      },
      me: function () {
        return request("/api/auth/me");
      },
    },

    tasks: {
      list: function (params) {
        var qs = new URLSearchParams();
        Object.keys(params || {}).forEach(function (k) {
          if (params[k] !== "" && params[k] !== null && params[k] !== undefined) qs.set(k, params[k]);
        });
        var s = qs.toString();
        return request("/api/tasks" + (s ? "?" + s : ""));
      },
      create: function (payload) {
        return request("/api/tasks", { method: "POST", body: payload, retry: false });
      },
      update: function (id, payload) {
        return request("/api/tasks/" + id, { method: "PATCH", body: payload, retry: false });
      },
      remove: function (id) {
        return request("/api/tasks/" + id, { method: "DELETE", retry: false });
      },
    },

    admin: {
      overview: function () {
        return request("/api/admin/overview");
      },
      users: function (params) {
        var qs = new URLSearchParams(params || {}).toString();
        return request("/api/admin/users" + (qs ? "?" + qs : ""));
      },
      updateUser: function (id, payload) {
        return request("/api/admin/users/" + id, { method: "PATCH", body: payload, retry: false });
      },
      tasks: function (params) {
        var qs = new URLSearchParams(params || {}).toString();
        return request("/api/admin/tasks" + (qs ? "?" + qs : ""));
      },
      removeTask: function (id) {
        return request("/api/admin/tasks/" + id, { method: "DELETE", retry: false });
      },
    },
  };

  window.API = API;
})();
