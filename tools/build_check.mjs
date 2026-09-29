#!/usr/bin/env node
/**
 * build_check.mjs — 「build」佔位門檻（ADR-0001 決策 B：純靜態不打包）
 *
 * 純靜態站沒有真正的 build 步驟，此腳本代替 build 檢查部署關鍵不變量：
 *   1. 部署必要檔案存在（index.html / manifest.json / sw.js）
 *   2. manifest.json 可解析且 icons 指向的檔案存在
 *   3. 無超過 5 MB 的單一前端資源會進入部署範圍（防 21MB 字型事件重演）
 *
 * 退出碼：0 = 通過；1 = 違規
 */
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SIZE_LIMIT = 5 * 1024 * 1024;

// 已登記的大檔：有明確用途且載入方式不傷首屏（登記時須附理由）
const SIZE_ALLOWLIST = {
  "assets/holiday/holiday-02.mp4": "七七地赦影片輪播，lazy load（點擊才建立 <video>），不上首屏",
  "assets/holiday/holiday-03.mp4": "同上",
  "assets/holiday/holiday-04.mp4": "同上",
  "assets/holiday/holiday-05.mp4": "同上",
};

const violations = [];

// 1. 必要檔案
for (const f of ["index.html", "manifest.json", "sw.js"]) {
  if (!existsSync(join(ROOT, f))) violations.push(`缺少部署必要檔案：${f}`);
}

// 2. manifest 與 icons
try {
  const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf-8"));
  for (const icon of manifest.icons ?? []) {
    const p = join(ROOT, icon.src.replace(/^\//, ""));
    if (!existsSync(p)) violations.push(`manifest icon 不存在：${icon.src}`);
  }
} catch (e) {
  violations.push(`manifest.json 解析失敗：${e.message}`);
}

// 3. 部署範圍內的大檔（依 .vercelignore 口徑只查會上線的目錄）
const DEPLOY_DIRS = ["assets", "icons", "js", "css", "pages"];
function* walk(dir) {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) yield* walk(rel);
    else yield rel;
  }
}
for (const dir of DEPLOY_DIRS) {
  if (!existsSync(join(ROOT, dir))) continue;
  for (const rel of walk(dir)) {
    const size = statSync(join(ROOT, rel)).size;
    if (size > SIZE_LIMIT && !SIZE_ALLOWLIST[rel]) {
      violations.push(`超過 5MB 的前端資源：${rel}（${(size / 1048576).toFixed(1)} MB）`);
    }
  }
}

// 4. H1 基座：base.css 與來源同步（ADR-0003，防改 token 忘記重編）
const BASE_DIR = join(ROOT, "out", "rewrite", "base");
if (existsSync(join(BASE_DIR, "base.css"))) {
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256");
  for (const s of ["tokens.cjs", "tailwind.config.cjs", "src/input.css"]) {
    hash.update(readFileSync(join(BASE_DIR, s)));
    hash.update("\0");
  }
  const expected = hash.digest("hex");
  const hashFile = join(BASE_DIR, ".sources.sha256");
  if (!existsSync(hashFile)) {
    violations.push("base.css 存在但缺 .sources.sha256，請跑 npm run build:css");
  } else {
    const actual = readFileSync(hashFile, "utf-8").trim();
    if (actual !== expected) violations.push("base.css 與來源不同步（tokens/config/input.css 已改），請跑 npm run build:css");
  }
}

if (violations.length) {
  console.log("❌ build 檢查未通過：");
  for (const v of violations) console.log(`   ${v}`);
  process.exit(1);
}
console.log("🟢 build 檢查通過（純靜態站：部署不變量檢查代替打包）");
