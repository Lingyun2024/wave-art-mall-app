/**
 * WAVE ART MALL 觀測指標採集（純本地，不動線上）
 * 用法：npm run metrics       快採（4 項，秒級）
 *      npm run metrics --full 含門檻與斷鏈（較慢）
 *
 * 輸出：終端儀表板 + 追加 .workbuddy/memory/metrics.jsonl
 */

import { createServer } from "node:http";
import { readFile, readdir, stat, appendFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join, extname, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const FULL = process.argv.includes("--full");

const r = (p) => join(ROOT, p);
const sha = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 16);

async function shaOf(rel) {
  try {
    return sha(await readFile(r(rel)));
  } catch {
    return null;
  }
}

/* ---------- 1. 頁面可達率（起臨時靜態 server，測完即關） ---------- */
async function pagesReachable() {
  const pagesDir = r("pages");
  const files = (await readdir(pagesDir)).filter((f) => f.endsWith(".html"));
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

  const server = createServer(async (req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const path = url === "/" ? r("index.html") : r(url.replace(/^\//, ""));
    try {
      const body = await readFile(path);
      res.writeHead(200, { "Content-Type": mime[extname(path)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("nf");
    }
  });

  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const port = server.address().port;
  let ok = 0;
  for (const f of files) {
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/pages/${f}`);
      if (resp.status === 200) ok++;
    } catch {
      /* 計為不可達 */
    }
  }
  // index.html 也算一頁
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/`);
    if (resp.status === 200) ok++;
  } catch {
    /* noop */
  }
  await new Promise((ok2) => server.close(ok2));
  return { ok, total: files.length + 1 };
}

/* ---------- 2. CSS hash 同步 ----------
   算法需與 tools/build_css.mjs 一致：
   三個來源檔內容依序 update，每個後面補 "\0"，取整體 sha256 hex */
async function cssHashSync() {
  const sources = [
    "out/rewrite/base/tokens.cjs",
    "out/rewrite/base/tailwind.config.cjs",
    "out/rewrite/base/src/input.css",
  ];
  const recordPath = r("out/rewrite/base/.sources.sha256");
  if (!existsSync(recordPath)) return { sync: null, reason: "無 .sources.sha256 記錄" };

  const h = createHash("sha256");
  for (const s of sources) {
    try {
      h.update(await readFile(r(s)));
    } catch {
      return { sync: null, reason: `來源檔缺失 ${s}` };
    }
    h.update("\0");
  }
  const cur = h.digest("hex");
  const saved = (await readFile(recordPath, "utf8")).trim();
  return cur === saved ? { sync: true } : { sync: false, reason: "來源已變更未重編" };
}

/* ---------- 3. 單檔資產超限 ---------- */
async function oversizeAssets() {
  const dirs = ["assets", "pages", "js", "css", "icons"];
  const LIMIT = 5 * 1024 * 1024;
  let count = 0;
  const list = [];
  for (const d of dirs) {
    if (!existsSync(r(d))) continue;
    for (const f of await readdir(r(d))) {
      const p = r(`${d}/${f}`);
      const st = await stat(p);
      if (st.isFile() && st.size > LIMIT) {
        count++;
        list.push(`${d}/${f} (${(st.size / 1024 / 1024).toFixed(1)}MB)`);
      }
    }
  }
  return { count, list };
}

/* ---------- 4. 待拍板項 / 人工介入率 ----------
   人工介入率 = 未決項 / board.md 任務總數（不是決策行數，否則初始必為 100%） */
async function openDecisions() {
  const p = r("docs/ops/OPEN-DECISIONS.md");
  if (!existsSync(p)) return { open: 0, total: 0, tasks: 0 };
  const txt = await readFile(p, "utf8");
  const rows = txt.split("\n").filter((l) => l.trim().startsWith("| 2026-"));
  const open = rows.filter((l) => l.includes("OPEN")).length;

  let tasks = 0;
  const b = r("docs/board.md");
  if (existsSync(b)) {
    const bt = await readFile(b, "utf8");
    tasks = bt
      .split("\n")
      .filter((l) => l.trim().startsWith("|") && /✅|🟡|🔴|⏳|⚪/.test(l)).length;
  }
  return { open, total: rows.length, tasks };
}

/* ---------- 5/6. 門檻與斷鏈（--full 才跑） ---------- */
async function fullChecks() {
  const { spawnSync } = await import("node:child_process");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const gates = ["lint", "check:links", "check:html", "build"]; // e2e 另計，較慢
  let pass = 0;
  for (const g of gates) {
    const res = spawnSync(npm, ["run", g], { cwd: ROOT, shell: true });
    if (res.status === 0) pass++;
  }
  const links = spawnSync(npm, ["run", "check:links"], { cwd: ROOT, shell: true });
  const out = String(links.stdout || "");
  const m = out.match(/(\d+)\s*(?:個)?(?:斷鏈|broken)/);
  return { gates_pass: pass, gates_total: gates.length, broken_links: m ? Number(m[1]) : 0 };
}

/* ---------- 主流程 ---------- */
const [pages, css, assets, dec] = await Promise.all([
  pagesReachable(),
  cssHashSync(),
  oversizeAssets(),
  openDecisions(),
]);

let gates = { gates_pass: null, gates_total: null, broken_links: null };
if (FULL) gates = await fullChecks();

const rec = {
  ts: new Date().toISOString(),
  pages_ok: pages.ok,
  pages_total: pages.total,
  css_hash_sync: css.sync,
  oversize_assets: assets.count,
  open_decisions: dec.open,
  total_decisions: dec.total,
  total_tasks: dec.tasks,
  ...gates,
};

const judge = (cond, warn) => (cond === null ? "N/A" : cond ? "OK" : warn);

console.log("\n===== WAVE ART MALL 觀測指標 =====");
console.log(`採集時間      ${rec.ts}`);
console.log(`頁面可達率    ${pages.ok}/${pages.total}  ${judge(pages.ok === pages.total, "FAIL")}`);
console.log(`CSS hash 同步 ${css.sync === null ? "N/A（無記錄）" : css.sync ? "OK" : "FAIL " + css.reason}`);
console.log(`單檔超限資產  ${assets.count}  ${judge(assets.count === 0, "WARN")}`);
const rate = dec.tasks ? dec.open / dec.tasks : null;
const rateTxt = rate === null ? "N/A" : `${(rate * 100).toFixed(0)}%`;
console.log(
  `待拍板項      ${dec.open} 項 / 任務 ${dec.tasks}  → 人工介入率 ${rateTxt}  ${
    rate === null ? "" : rate < 0.3 ? "OK" : "WARN"
  }`,
);
if (FULL) {
  console.log(`門檻通過率    ${gates.gates_pass}/${gates.gates_total}`);
  console.log(`斷鏈數        ${gates.broken_links}`);
} else {
  console.log(`（門檻/斷鏈未採集，加 --full 啟用）`);
}
if (assets.list.length) console.log(`  超限檔：${assets.list.join(", ")}`);
console.log("==================================\n");

await mkdir(r(".workbuddy/memory"), { recursive: true });
await appendFile(r(".workbuddy/memory/metrics.jsonl"), JSON.stringify(rec) + "\n");
console.log("已記錄 → .workbuddy/memory/metrics.jsonl");
