#!/usr/bin/env node
/**
 * check_links.mjs — 全站連結與孤立頁檢查（品質門檻，紅燈即不可合併）
 *
 * 檢查項目：
 *   1. 斷鏈：index.html 與 pages/*.html 內所有 href/src 指向的本機檔案必須存在
 *   2. 孤立頁：pages/ 下的頁面若沒有任何其他頁面連得到（含 JS 動態跳轉字串），
 *      必須在 tools/link_allowlist.json 中登記保留理由，否則視為違規
 *
 * 退出碼：0 = 全綠；1 = 有斷鏈或未登記的孤立頁
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, basename, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWLIST_PATH = join(ROOT, "tools", "link_allowlist.json");

const htmlFiles = [
  "index.html",
  ...readdirSync(join(ROOT, "pages"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => `pages/${f}`),
];

const SKIP_PREFIX = ["http", "#", "mailto:", "data:", "javascript:", "tel:"];

// ── 1. 斷鏈檢查 ─────────────────────────────────────────────
const broken = [];
let checked = 0;
for (const file of htmlFiles) {
  const src = readFileSync(join(ROOT, file), "utf-8");
  for (const m of src.matchAll(/(?:href|src)="([^"]+)"/g)) {
    let url = m[1];
    if (SKIP_PREFIX.some((p) => url.startsWith(p))) continue;
    if (url.includes("${") || url.includes("' +") || url.includes("+ '")) continue; // JS 樣板字串，非靜態連結
    url = decodeURIComponent(url.split("#")[0].split("?")[0]);
    if (!url) continue;
    checked++;
    const target = normalize(join(ROOT, dirname(file), url));
    if (!existsSync(target)) broken.push({ file, url });
  }
}

// ── 2. 孤立頁檢查（含 JS 動態跳轉：掃描所有被引號包住、以 .html 結尾的字串）──
const allPages = new Set(
  readdirSync(join(ROOT, "pages"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => basename(f))
);
const linked = new Set();
for (const file of htmlFiles) {
  const src = readFileSync(join(ROOT, file), "utf-8");
  for (const m of src.matchAll(/["']([^"']*\.html[^"']*)["']/g)) {
    const u = m[1];
    if (u.startsWith("http") || u.startsWith("#")) continue;
    linked.add(basename(u.split("#")[0].split("?")[0]));
  }
}
// 首頁本身也算入口
linked.add("index.html");

let allowlist = {};
if (existsSync(ALLOWLIST_PATH)) {
  allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf-8"));
}
const orphans = [...allPages].filter((p) => !linked.has(p));
const unregistered = orphans.filter((p) => !(p in allowlist));

// ── 報告 ────────────────────────────────────────────────────
console.log(`掃描頁面：${htmlFiles.length}　本機參考：${checked}`);
console.log("");

if (broken.length) {
  console.log(`❌ 斷鏈 ${broken.length} 條：`);
  for (const b of broken) console.log(`   ${b.file} -> ${b.url}`);
} else {
  console.log("✅ 斷鏈：0");
}

console.log("");
if (orphans.length) {
  console.log(`孤立頁 ${orphans.length} 個：`);
  for (const p of orphans) {
    const reason = allowlist[p];
    console.log(reason ? `   ✅ ${p}（已登記：${reason}）` : `   ❌ ${p}（未登記保留理由）`);
  }
} else {
  console.log("✅ 孤立頁：0");
}

if (broken.length || unregistered.length) {
  console.log("\n🔴 check:links 未通過");
  process.exit(1);
}
console.log("\n🟢 check:links 通過");
