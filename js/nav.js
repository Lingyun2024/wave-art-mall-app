/*
  =========================================================
  nav.js —— 全站共用的导览列逻辑
  =========================================================
  新手说明：
  这个档案负责处理「每个页面共通」的导览列行为，包括：
  1. 判断使用者有没有登入，切换显示「登入」或「登出」按钮
  2. 按下登出按钮时，呼叫 supabase.auth.signOut() 登出
  3. 进入页面时，更新购物车角标的数字

  使用方式：
  每个页面的 HTML 里面，导览列需要放这些元素（id 要对上）：
    <a id="nav-auth-link">登入</a>  <!-- 会自动切换文字/行为 -->
    <span class="js-cart-badge hidden"></span> <!-- 购物车角标 -->

  然后在页面最下面引入：
    <script src="../js/supabaseClient.js"></script>
    <script src="../js/nav.js"></script>
*/

// 页面一读取完成，就执行导览列初始化
document.addEventListener("DOMContentLoaded", () => {
  initNavAuthState();
  updateCartBadge();
});

// -----------------------------------------------------
// 初始化导览列的登入/登出状态
// -----------------------------------------------------
async function initNavAuthState() {
  const authLink = document.getElementById("nav-auth-link");
  if (!authLink) return; // 这个页面如果没放这个元素就跳过，不报错

  const user = await getCurrentUser();

  if (user) {
    // 已登入 -> 显示「登出」，并且加上点击事件
    authLink.textContent = "登出";
    authLink.href = "javascript:void(0)";
    authLink.onclick = async (e) => {
      e.preventDefault();
      await handleLogout();
    };
  } else {
    // 未登入 -> 显示「登入」，点击后导去登入页
    authLink.textContent = "登入";
    authLink.href = getPathTo("pages/auth.html");
    authLink.onclick = null;
  }
}

// -----------------------------------------------------
// 处理登出：呼叫 supabase.auth.signOut()，成功后刷新页面
// -----------------------------------------------------
async function handleLogout() {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    showToast("已成功登出");
    // 登出后重新整理页面，导览列会自动变回「登入」状态
    setTimeout(() => {
      window.location.reload();
    }, 600);
  } catch (err) {
    console.error("[handleLogout] 登出失败:", err);
    showToast("登出失败，请稍后再试", "error");
  }
}
