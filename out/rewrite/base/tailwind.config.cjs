/*
  =========================================================
  tailwind.config.cjs —— Tailwind v3 編譯設定（H1 凍結）
  =========================================================
  依 ADR-0003。token 來源 = 本目錄 tokens.cjs（唯一事實來源）。
  content 只掃 24 頁重寫範圍（brief Q1②），商城 9 頁刻意排除，
  避免範圍外的 class 需求膨脹 base.css。

  重新編譯：npm run build:css
*/

const tokens = require("./tokens.cjs");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...tokens,
  content: [
    // 24 頁重寫範圍（宗教 8 / 火星療癒 7 / 七七地赦 5 / 管理後台 4）
    // base 位於 out/rewrite/base/，專案根目錄需上三層 ../../../
    "../../../pages/living-buddha.html",
    "../../../pages/religion.html",
    "../../../pages/temple.html",
    "../../../pages/monastery.html",
    "../../../pages/palace.html",
    "../../../pages/hall.html",
    "../../../pages/soft-power.html",
    "../../../pages/soft-power-healing.html",
    "../../../pages/mars-healing-intro.html",
    "../../../pages/mars-healing.html",
    "../../../pages/mars-healing-detail.html",
    "../../../pages/mars-healing-register.html",
    "../../../pages/mars-healing-history.html",
    "../../../pages/mars-healing-admin.html",
    "../../../pages/mars-healing-success.html",
    "../../../pages/holiday-entry.html",
    "../../../pages/holiday-select.html",
    "../../../pages/holiday-form.html",
    "../../../pages/holiday.html",
    "../../../pages/my-roster.html",
    "../../../pages/admin-summary.html",
    "../../../pages/admin-summary-headquarter.html",
    "../../../pages/admin-roster.html",
    "../../../pages/admin-roster-headquarter.html",
    // 基座 js 動態產生的 class 也要被掃到
    "./*.js",
  ],
  // v3 會對 @layer components 的客製類別做 tree-shake（未使用就不輸出）。
  // 共享元件是契約資產，即使 24 頁尚未用到也要凍結在 base.css，
  // 頁面模組不得因「還沒人用」而遺失。
  safelist: [
    "glass-card",
    "glass-panel",
    "gold-frame",
    "art-frame",
    "neon-glow",
    "neon-glow-hover",
    "input-glow",
    "hide-scrollbar",
    "gradient-mesh",
    "site-header",
    "cart-badge",
    "site-bottom-nav",
    "loading-spinner",
    "star-filled",
    "star-empty",
  ],
};
