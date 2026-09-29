/*
  =========================================================
  nav.js —— 全站導覽列（H1 凍結）
  =========================================================
  契約（評審必查）：
  1. 頁面只需放 <header id="site-header"></header> 與（選用）
     <nav id="site-bottom-nav"></nav>，結構由本檔統一渲染
  2. 導覽項目資料來源 = WAVE_NAV_ITEMS（本檔下方），頁面不得自刻導覽列
  3. 登入/登出狀態切換、購物車角標由本檔自動處理

  目前 24 頁重寫範圍採「模組內導覽」（各模組首頁為主入口），
  全站統一導覽列待 H3 連結圖拍板後啟用 WAVE_NAV_ITEMS。
*/

// 導覽項目（H3 連結圖凍結後填寫；目前僅定結構）
const WAVE_NAV_ITEMS = [];

// 頂部導覽列 HTML（含登入狀態掛點 #nav-auth-link 與購物車角標 .js-cart-badge）
function renderSiteHeader() {
  const header = document.getElementById("site-header");
  if (!header) return;

  header.classList.add("site-header");
  header.innerHTML = `
    <a href="${window.WAVE.getPathTo("index.html")}" class="font-headline-lg text-headline-lg text-secondary tracking-widest">
      WAVE ART MALL
    </a>
    <div class="flex items-center gap-4">
      <a id="nav-auth-link" class="text-on-surface-variant hover:text-secondary transition-colors font-label-sm text-label-sm uppercase"></a>
    </div>
  `;
}

// 底部導覽列（手機版）
function renderSiteBottomNav() {
  const nav = document.getElementById("site-bottom-nav");
  if (!nav) return;
  nav.classList.add("site-bottom-nav");
  nav.innerHTML = WAVE_NAV_ITEMS.map(
    (item) => `
    <a href="${item.href}" class="flex flex-col items-center justify-center text-on-surface-variant/60 hover:text-secondary transition-colors">
      <span class="material-symbols-outlined mb-1">${item.icon}</span>
      <span class="font-label-sm text-label-sm uppercase">${item.label}</span>
    </a>
  `,
  ).join("");
}

// -----------------------------------------------------
// 登入 / 登出狀態
// -----------------------------------------------------
async function initNavAuthState() {
  const authLink = document.getElementById("nav-auth-link");
  if (!authLink) return;

  const user = await window.WAVE.getCurrentUser();

  if (user) {
    authLink.textContent = "登出";
    authLink.href = "javascript:void(0)";
    authLink.onclick = async (e) => {
      e.preventDefault();
      await handleLogout();
    };
  } else {
    authLink.textContent = "登入";
    authLink.href = window.WAVE.getPathTo("pages/auth.html");
    authLink.onclick = null;
  }
}

async function handleLogout() {
  try {
    const { error } = await window.WAVE.db.auth.signOut();
    if (error) throw error;
    window.WAVE.showToast("已成功登出");
    setTimeout(() => {
      window.location.reload();
    }, 600);
  } catch (err) {
    console.error("[handleLogout] 登出失敗:", err);
    window.WAVE.showToast("登出失敗，請稍後再試", "error");
  }
}

// 頁面載入完成後初始化
document.addEventListener("DOMContentLoaded", () => {
  renderSiteHeader();
  renderSiteBottomNav();
  initNavAuthState();
});
