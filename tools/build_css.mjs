#!/usr/bin/env node
/**
 * build_css.mjs — 重新編譯 out/rewrite/base/base.css（ADR-0003）
 *
 * 觸發時機：
 *   - 改了 out/rewrite/base/tokens.cjs（設計 token）
 *   - 改了 out/rewrite/base/tailwind.config.cjs（內容掃描範圍 / safelist）
 *   - 改了 out/rewrite/base/src/input.css（共享元件樣式）
 *   - 24 頁重寫範圍新增/移除頁面
 *
 * 編譯後會重寫 out/rewrite/base/.sources.sha256；
 * `npm run build` 門禁會比對此 hash，改源檔忘記重編 = 紅燈。
 */
import { createRequire } from "node:module";
import { writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = join(ROOT, "out", "rewrite", "base");
const SOURCES = ["tokens.cjs", "tailwind.config.cjs", join("src", "input.css")];

const hash = createHash("sha256");
for (const s of SOURCES) {
  hash.update(readFileSync(join(BASE, s)));
  hash.update("\0");
}
const digest = hash.digest("hex");

const tailwindCli = require.resolve("tailwindcss/lib/cli.js");
const result = spawnSync(
  process.execPath,
  [tailwindCli, "-c", join(BASE, "tailwind.config.cjs"), "-i", join(BASE, "src", "input.css"), "-o", join(BASE, "base.css"), "--minify"],
  { stdio: "inherit" },
);

if (result.status !== 0) {
  console.error("❌ Tailwind 編譯失敗");
  process.exit(result.status ?? 1);
}

writeFileSync(join(BASE, ".sources.sha256"), digest + "\n");
console.log("🟢 base.css 編譯完成，來源 hash 已更新：" + digest.slice(0, 12));
