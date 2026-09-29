/*
  =========================================================
  meta.js —— OG / meta 產生方式（H1 凍結）
  =========================================================
  契約（評審必查，對應 brief 最終驗收「每頁有 meta description + OG」）：
  1. 靜態頁：head 直接寫齊 title / description / og:*（用 applyMeta 或手寫皆可，
     但欄位缺一不可）
  2. 動態頁（依查詢參數載入內容者，如商品詳情）：預設 OG 用靜態佔位，
     資料載入後呼叫 applyOpenGraph() 覆寫 og:title / og:description / og:image
  3. og:image 一律用絕對 URL（https://wave-art-mall.vercel.app/...）

  歷史：applyOpenGraph 模式承繼 pages/product-detail.html（2026-09-12 修復批次）。
*/

const WAVE_SITE_URL = "https://wave-art-mall.vercel.app";
const WAVE_DEFAULT_OG_IMAGE = WAVE_SITE_URL + "/icons/icon-512.png";

// 確保指定屬性的 meta 標籤存在，並寫入內容
function upsertMeta(attr, attrValue, content) {
  let el = document.querySelector(`meta[${attr}="${attrValue}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// 一次寫齊靜態頁的 description + OG 全欄位
function applyMeta({ title, description, path, image }) {
  document.title = title;
  upsertMeta("name", "description", description);
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:site_name", "WAVE ART MALL");
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:image", image || WAVE_DEFAULT_OG_IMAGE);
  upsertMeta("property", "og:url", WAVE_SITE_URL + path);
  upsertMeta("name", "twitter:card", "summary_large_image");
}

// 動態頁資料載入後覆寫 OG（title 欄位對應欄位名可為 name 或 title）
function applyOpenGraph({ name, title, description, image }) {
  const displayTitle = "WAVE ART MALL - " + (name || title || "");
  upsertMeta("property", "og:title", displayTitle);
  if (description) upsertMeta("property", "og:description", description);
  if (image) upsertMeta("property", "og:image", image);
}

window.WAVE = window.WAVE || {};
window.WAVE.meta = { applyMeta, applyOpenGraph, WAVE_SITE_URL, WAVE_DEFAULT_OG_IMAGE };
