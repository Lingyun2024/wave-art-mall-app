/**
 * check_deploy_drift.mjs — 本地 ↔ 線上版本落差檢查
 *
 * 本站上線途徑是 Vercel CLI 直接上傳（.vercel/project.json：wave-art-mall，outputDirectory "."），
 * 不是 git push。所以「本地改了」不等於「線上有」——本工具就是拿來驗這一點。
 *
 * 純只讀：只對線上發 GET，不寫任何東西、不觸發部署。
 * 用法：node tools/check_deploy_drift.mjs
 *      BASE=https://其他網域 node tools/check_deploy_drift.mjs
 *
 * 比對方式：sha256（先剝 BOM、CRLF 正規化為 LF，避免格式差異造成假警報）
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BASE = (process.env.BASE || "https://wave-art-mall.vercel.app").replace(/\/$/, "");

/* ---------- 收集要比對的檔案 ---------- */
function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", ".git", ".vercel", "_legacy_messed_up", "backups"].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(html|js|css|json)$/i.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const files = [
  join(ROOT, "index.html"),
  ...walk(join(ROOT, "pages")),
  ...walk(join(ROOT, "js")),
  ...walk(join(ROOT, "css")),
].filter((p) => {
  try {
    return statSync(p).size < 2_000_000; // 跳過超大檔（字型等另行處理）
  } catch {
    return false;
  }
});

const norm = (buf) => {
  let s = buf.toString("utf8");
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); // 剝 BOM
  return s.replace(/\r\n/g, "\n");
};
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);

const results = { same: 0, diff: 0, missing: 0, skipped: 0 };
const diffs = [];
const missings = [];

console.log(`比對 ${files.length} 個檔案 ↔ ${BASE}`);
console.log("-----------------------------------------------------------------");

for (const abs of files) {
  const rel = relative(ROOT, abs).replace(/\\/g, "/");
  const local = sha(norm(readFileSync(abs)));

  let res;
  try {
    res = await fetch(`${BASE}/${rel}`, { redirect: "follow" });
  } catch (e) {
    results.skipped++;
    console.log(`  ⚪ ${rel} — 無法連線（${e.message}）`);
    continue;
  }

  if (res.status === 404) {
    results.missing++;
    missings.push(rel);
    console.log(`  ⚫ ${rel} — 線上 404（本地有、線上無）`);
    continue;
  }
  if (!res.ok) {
    results.skipped++;
    console.log(`  ⚪ ${rel} — HTTP ${res.status}`);
    continue;
  }

  const remote = sha(norm(Buffer.from(await res.arrayBuffer())));
  if (local === remote) {
    results.same++;
  } else {
    results.diff++;
    diffs.push(rel);
    console.log(`  🟡 ${rel} — 內容不同（本地 ${local} / 線上 ${remote}）`);
  }
}

console.log("-----------------------------------------------------------------");
console.log(
  `一致 ${results.same} ／ 不同 ${results.diff} ／ 線上缺 ${results.missing} ／ 略過 ${results.skipped}`
);
if (diffs.length) {
  console.log("\n需要重新部署才會同步的檔案：");
  for (const d of diffs) console.log(`  • ${d}`);
}
if (missings.length) {
  console.log("\n本地有但線上沒有（新檔，需部署後才存在）：");
  for (const m of missings) console.log(`  • ${m}`);
}
console.log("-----------------------------------------------------------------");
console.log("註：本工具只讀。要同步請自行執行 vercel deploy（動線上，需族族放行）。");
