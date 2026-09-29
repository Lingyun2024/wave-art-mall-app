
  /*
    =========================================================
    登入注册页专属逻辑
    =========================================================
    这一段负责：
    1. 切换「登入」/「注册」两个分页表单的显示
    2. 登入：呼叫 supabase.auth.signInWithPassword()
    3. 注册：呼叫 supabase.auth.signUp()（不需要做 email 验证，
       所以注册成功后通常会直接拿到 session，可以视为已登入）
    4. 登入/注册成功后，检查 localStorage 里有没有记录「原本要去的页面」，
       有的话就导回去，没有就导回首页
  */

  // -----------------------------------------------------
  // 驗證信 / 重設密碼信的「導回網址」
  // -----------------------------------------------------
  // 一定要用正式站的網址，而且必須存在於 Supabase 後台的 Redirect URLs 白名單，
  // 否則信件連結會失效。不可用 window.location.href：
  // 本機測試時會變成 file:// 或 127.0.0.1，Supabase 會直接拒絕該網址。
  const AUTH_REDIRECT_URL = "https://wave-art-mall.vercel.app/pages/auth.html";

  // -----------------------------------------------------
  // 被其他頁面導回本頁時，顯示網址上的提示參數
  // -----------------------------------------------------
  // 情境：requireLogin() 發現使用者沒登入或沒驗證 Email，
  // 會導到 auth.html?notice=verify-email，但先前本頁沒有讀這個參數，
  // 使用者只會被丟回登入頁、完全不知道發生什麼事。
  function showNoticeFromQuery() {
    const MESSAGES = {
      "verify-email": "您的電子郵件尚未完成驗證。請到信箱點擊驗證連結後再登入；若沒收到，請按下方「尚未收到驗證信？重新寄送」。"
    };
    const notice = new URLSearchParams(window.location.search).get("notice");
    const el = document.getElementById("auth-notice");
    if (!notice || !el) return;
    const msg = MESSAGES[notice];
    if (!msg) return;
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  // -----------------------------------------------------
  // 分页标签切换（登入 <-> 注册）
  // -----------------------------------------------------
  function switchTab(target) {
    const isLogin = target === "login";
    document.getElementById("tab-login").classList.toggle("active", isLogin);
    document.getElementById("tab-signup").classList.toggle("active", !isLogin);
    document.getElementById("login-form").classList.toggle("hidden", !isLogin);
    document.getElementById("signup-form").classList.toggle("hidden", isLogin);
  }

  // -----------------------------------------------------
  // 登入成功 / 注册成功后，导向「原本要去的页面」或首页
  // -----------------------------------------------------
  function redirectAfterAuth() {
    const rawBackUrl = localStorage.getItem("wave_redirect_after_login");
    localStorage.removeItem("wave_redirect_after_login");

    if (rawBackUrl) {
      try {
        const normalizedBackUrl = /^(https?:)?\/\//.test(rawBackUrl) || rawBackUrl.startsWith("/")
          ? rawBackUrl
          : rawBackUrl.startsWith("pages/")
            ? `/${rawBackUrl}`
            : `/pages/${rawBackUrl}`;
        const backUrl = new URL(normalizedBackUrl, window.location.origin);
        // 安全校验：只允许同域、且不是 auth 页本身（避免循环），才跳回
        const isAuthPage = backUrl.pathname.endsWith("/pages/auth.html") ||
                           backUrl.pathname.endsWith("/auth.html") ||
                           backUrl.pathname === "/pages/auth" ||
                           backUrl.pathname === "/auth";
        if (backUrl.origin === window.location.origin && !isAuthPage) {
          window.location.href = backUrl.href;
          return;
        }
      } catch (e) {
        // URL 不合法，直接 fallthrough 回首页
      }
    }
    window.location.href = "../index.html";
  }

  // -----------------------------------------------------
  // 处理登入表单送出
  // -----------------------------------------------------
  async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const btn = document.getElementById("btn-login");

    btn.disabled = true;
    btn.textContent = "登入中...";

    try {
      // 这一段是呼叫 Supabase Auth 的登入功能，把帐号密码送过去验证
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;

      showToast("登入成功！");
      setTimeout(redirectAfterAuth, 500);
    } catch (err) {
      console.error("[handleLogin] 登入失败:", err);
      showToast(translateAuthError(err.message), "error");
      btn.disabled = false;
      btn.textContent = "登入";
    }
  }

  // -----------------------------------------------------
  // 处理注册表单送出
  // -----------------------------------------------------
  async function handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const passwordConfirm = document.getElementById("signup-password-confirm").value;
    const btn = document.getElementById("btn-signup");

    // 简单验证两次密码是否一致
    if (password !== passwordConfirm) {
      showToast("兩次輸入的密碼不一致", "error");
      return;
    }

    btn.disabled = true;
    btn.textContent = "建立帳戶中...";
    let shouldKeepButtonDisabled = false;

    try {
      // 这一段是呼叫 Supabase Auth 的注册功能，建立一个新的帐号
      const { data, error } = await Promise.race([
        supabaseClient.auth.signUp({
          email,
          password,
          // 明確指定驗證信連結要導回哪裡，不要依賴後台 Site URL 的預設值
          options: { emailRedirectTo: AUTH_REDIRECT_URL }
        }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("註冊請求逾時，請稍後再試")), 15000);
        })
      ]);
      if (error) throw error;

      if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
        document.getElementById("login-email").value = email;
        switchTab("login");
        showToast("此電子郵件已被註冊，請直接登入；若尚未驗證可補寄驗證信", "error");
        return;
      }

      // 因为不需要 email 验证，注册成功后通常已经自动登入（拿到 session）
      if (data.session) {
        shouldKeepButtonDisabled = true;
        showToast("註冊成功，已自動登入！");
        setTimeout(redirectAfterAuth, 500);
      } else {
        // 少数情况下 Supabase 项目仍设定需要验证邮件，这里给使用者提示
        document.getElementById("login-email").value = email;
        showToast("註冊成功，請查看信箱完成驗證後再登入");
        switchTab("login");
      }
    } catch (err) {
      console.error("[handleSignup] 注册失败:", err);
      // 「逾時」多半是 Supabase 端寄送驗證信失敗（實測會卡約 35 秒）。
      // 此時帳號其實「還沒建立」，必須講清楚，否則使用者會以為已註冊成功、
      // 之後登入卻一直失敗，而卡在「登入↔註冊」的迴圈裡。
      if ((err?.message || "").includes("註冊請求逾時")) {
        showToast("註冊未完成：伺服器無回應，您的帳號尚未建立。請稍後再試，或聯絡管理員。", "error");
      } else {
        showToast(translateAuthError(err.message), "error");
      }
    } finally {
      if (!shouldKeepButtonDisabled) {
        btn.disabled = false;
        btn.textContent = "建立帳戶";
      }
    }
  }

  // -----------------------------------------------------
  // 補寄驗證信：手機註冊後若帳號尚未確認，可輸入註冊用信箱後按這個按鈕。
  // -----------------------------------------------------
  async function resendConfirmationEmail() {
    const email = document.getElementById("login-email").value.trim();
    if (!email) {
      showToast("請先在登入欄位輸入您的電子郵件", "error");
      document.getElementById("login-email").focus();
      return;
    }
    const button = document.getElementById("btn-resend-confirmation");
    button.disabled = true;
    button.textContent = "寄送中...";
    try {
      const { error } = await supabaseClient.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: AUTH_REDIRECT_URL }
      });
      if (error) throw error;
      showToast("驗證信已寄出，請到信箱點擊確認連結後再登入");
    } catch (err) {
      console.error("[resendConfirmationEmail] 補寄驗證信失敗:", err);
      showToast(translateAuthError(err.message), "error");
    } finally {
      button.disabled = false;
      button.textContent = "尚未收到驗證信？重新寄送";
    }
  }

  // -----------------------------------------------------
  // 忘記密碼：呼叫 Supabase Auth 寄出「重設密碼」信件。
  // 信件裡的連結會導向本頁（auth.html）並帶上重設憑證，進入頁面後自動顯示「設定新密碼」表單。
  // （注意：此功能依賴 Supabase 專案的「電子郵件寄送」正常運作；
  //   免費版會從 supabase.co 網域寄出，可能進垃圾郵件，需在後台確認。）
  // -----------------------------------------------------
  async function handleForgotPassword() {
    const email = document.getElementById("login-email").value.trim();
    if (!email) {
      showToast("請先在上方輸入您的電子郵件", "error");
      document.getElementById("login-email").focus();
      return;
    }
    const button = document.getElementById("btn-forgot-password");
    button.disabled = true;
    button.textContent = "寄送中...";
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: AUTH_REDIRECT_URL
      });
      if (error) throw error;
      showToast("重設密碼信件已寄出，請到信箱點擊連結（若沒看到請檢查垃圾郵件）");
    } catch (err) {
      console.error("[handleForgotPassword] 寄送重設密碼信失敗:", err);
      showToast(translateAuthError(err.message), "error");
    } finally {
      button.disabled = false;
      button.textContent = "忘記密碼？";
    }
  }

  // -----------------------------------------------------
  // 重設密碼（點擊信件連結進入本頁時觸發）
  // -----------------------------------------------------
  async function handlePasswordRecovery() {
    const hash = window.location.hash;
    // Supabase 重設連結會在網址後方帶上 #access_token=...&type=recovery
    if (!hash.includes("type=recovery") || !hash.includes("access_token")) return;

    try {
      // 從網址中讀取並建立 session（這一步會把憑證寫入本地）
      const { error } = await supabaseClient.auth.getSessionFromUrl();
      if (error) throw error;

      // 隱藏登入/註冊，顯示重設表單
      document.getElementById("tabs-bar").classList.add("hidden");
      document.getElementById("login-form").classList.add("hidden");
      document.getElementById("signup-form").classList.add("hidden");
      document.getElementById("reset-form").classList.remove("hidden");
    } catch (err) {
      console.error("[handlePasswordRecovery] 處理重設連結失敗:", err);
      showToast(translateAuthError(err.message), "error");
    }
  }

  // -----------------------------------------------------
  // 送出新密碼
  // -----------------------------------------------------
  async function handleResetPassword(e) {
    e.preventDefault();
    const pw = document.getElementById("reset-password").value;
    const pwConfirm = document.getElementById("reset-password-confirm").value;
    const btn = document.getElementById("btn-reset-password");

    if (pw !== pwConfirm) {
      showToast("兩次輸入的密碼不一致", "error");
      return;
    }

    btn.disabled = true;
    btn.textContent = "設定中...";
    try {
      const { error } = await supabaseClient.auth.updateUser({ password: pw });
      if (error) throw error;
      showToast("密碼已更新，請重新登入");
      setTimeout(() => { window.location.href = "../index.html"; }, 1200);
    } catch (err) {
      console.error("[handleResetPassword] 重設密碼失敗:", err);
      showToast(translateAuthError(err.message), "error");
      btn.disabled = false;
      btn.textContent = "設定新密碼";
    }
  }

  // 把 Supabase 常见的英文错误讯息翻成比较好懂的中文提示
  function translateAuthError(message) {
    if (!message) return "發生未知錯誤，請稍後再試";
    // 伺服器端寄信服務異常時，Supabase 會回 "upstream request timeout"（實測約卡 35 秒後才回）
    if (message.includes("upstream request timeout"))
      return "認證伺服器無回應，請稍後再試；若持續發生，請通知管理員檢查 Email 寄送設定";
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(message))
      return "網路連線失敗，請檢查網路後再試";
    if (message.includes("Invalid login credentials"))
      return "登入失敗：此電子郵件尚未註冊，或密碼輸入錯誤。若確定已註冊過，請按「忘記密碼？」重新設定";
    if (message.includes("Email not confirmed")) return "電子郵件尚未驗證，請到信箱點擊確認連結後再登入";
    if (message.includes("User already registered")) return "此電子郵件已被註冊過；請直接登入，或按「忘記密碼？」重新設定密碼";
    if (message.includes("Password should be at least")) return "密碼長度不足，至少需要 6 個字元";
    return message;
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("tab-login").addEventListener("click", () => switchTab("login"));
    document.getElementById("tab-signup").addEventListener("click", () => switchTab("signup"));
    document.getElementById("login-form").addEventListener("submit", handleLogin);
    document.getElementById("signup-form").addEventListener("submit", handleSignup);
    document.getElementById("btn-resend-confirmation").addEventListener("click", resendConfirmationEmail);
    document.getElementById("btn-forgot-password").addEventListener("click", handleForgotPassword);
    document.getElementById("reset-form").addEventListener("submit", handleResetPassword);
    // 若是由「重設密碼」信件連結進入，自動切換到重設表單
    handlePasswordRecovery();
    // 若被 requireLogin() 導回本頁（例如 ?notice=verify-email），顯示對應說明
    showNoticeFromQuery();
  });
