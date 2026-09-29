import { test, expect } from "@playwright/test";
import { readdirSync } from "node:fs";

/**
 * smoke.spec.mjs — 冒煙測試（品質門檻）
 *
 * 覆蓋（brief 第 8 節要求：首頁 + 商城主線 + 全站 HTTP 200）：
 *   1. 全站 34 頁 HTTP 200（含不動的商城 9 頁，防回歸）
 *   2. 首頁可渲染、標題正確、無未捕捉的頁面錯誤
 *   3. 商城主線四頁：category → product-detail → cart → checkout 均可開啟
 */

const pages = readdirSync("pages").filter((f) => f.endsWith(".html"));

test.describe("全站頁面 HTTP 200", () => {
  test("index.html", async ({ request }) => {
    const res = await request.get("/index.html");
    expect(res.status()).toBe(200);
  });
  for (const p of pages) {
    test(`pages/${p}`, async ({ request }) => {
      const res = await request.get(`/pages/${p}`);
      expect(res.status()).toBe(200);
    });
  }
});

test.describe("首頁渲染", () => {
  test("標題正確且無 pageerror", async ({ page }) => {
    test.setTimeout(60_000); // 外部 CDN（tailwind/fonts）在此網路下可能較慢
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    // 用 commit 而非 domcontentloaded：避免被 parser-blocking 的外部 CDN 卡住；
    // toHaveTitle 自帶等待，title 在 head 內隨首批 HTML 即可讀到
    await page.goto("/index.html", { waitUntil: "commit" });
    await expect(page).toHaveTitle(/WAVE ART MALL/);
    await page.waitForTimeout(3000); // 給 pageerror 事件一點觸發時間
    expect(errors).toEqual([]);
  });
});

test.describe("商城主線（Q1② 範圍外，回歸保護）", () => {
  for (const p of ["category", "product-detail", "cart", "checkout"]) {
    test(`${p} 可開啟`, async ({ page }) => {
      const res = await page.goto(`/pages/${p}.html`, { waitUntil: "domcontentloaded" });
      expect(res.status()).toBe(200);
    });
  }
});
