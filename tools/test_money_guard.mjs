/**
 * test_money_guard.mjs — 金流防線本地實測（R2）
 *
 * 用 PGlite（WASM Postgres，純本機記憶體）建最小 schema，
 * 套用 backend/order_amount_guard.sql，然後跑七個情境。
 *
 * 完全離線：不連 Supabase、不開 port、不寫線上資料。
 * 用法：npm run test:money
 *
 * 情境：
 *   T1 正常下單（單一交易內 orders + items）→ 金額 = 商品價 × 數量
 *   T2 改價攻擊 A：order_items.unit_price 塞 1 → 應被覆蓋為 products.price
 *   T3 改價攻擊 B：orders.total_amount 塞 1 → 寫明細後應重算為正確金額
 *   T4 真實 checkout 時序：orders / items 分兩次各自提交 → 必須成立（v1 死在這條）
 *   T5 偽造空單：只插 orders 沒明細 → 金額應被歸零，拿不到低價商品
 *   T6 七七地赦單（identity_type 非空）→ 人工金額不得被歸零
 *   T7 刪除明細 → 父單金額應重新結算
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PRICE_A = 1280;
const PRICE_B = 600;
const QTY = 2;
const EXPECTED = PRICE_A * QTY; // 2560

const SCHEMA = `
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price DECIMAL(12,2) NOT NULL
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  order_number TEXT,
  status TEXT,
  subtotal DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  shipping_fee DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  discount DECIMAL(12,2) DEFAULT 0,
  identity_type TEXT,
  recipient_name TEXT,
  phone TEXT,
  street_address TEXT,
  city TEXT,
  district TEXT,
  payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT,
  product_image_url TEXT,
  unit_price DECIMAL(12,2),
  quantity INTEGER,
  subtotal DECIMAL(12,2)
);

INSERT INTO products (name, price) VALUES ('測試商品A', ${PRICE_A}), ('測試商品B', ${PRICE_B});
`;

let pass = 0;
let fail = 0;

function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function freshDb() {
  const db = await PGlite.create();
  await db.exec(SCHEMA);
  const guard = readFileSync(resolve(ROOT, "backend/order_amount_guard.sql"), "utf8");
  await db.exec(guard);
  return db;
}

async function ids(db) {
  const r = await db.query("SELECT id FROM products ORDER BY price DESC");
  return { a: r.rows[0].id, b: r.rows[1].id };
}

const orderTotal = async (db, id) => {
  const r = await db.query("SELECT total_amount FROM orders WHERE id = $1", [id]);
  return Number(r.rows[0].total_amount);
};

/* ---------- T1：正常下單（單一交易內完成） ---------- */
async function t1() {
  console.log("\n【T1】正常下單（orders + items 在同一交易）");
  const db = await freshDb();
  const { a } = await ids(db);
  await db.exec(`
    BEGIN;
    INSERT INTO orders (user_id, status, total_amount, identity_type)
      VALUES (gen_random_uuid(), '待處理', ${EXPECTED}, NULL);
    INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
      SELECT id, '${a}', '測試商品A', ${PRICE_A}, ${QTY} FROM orders LIMIT 1;
    COMMIT;
  `);
  const r = await db.query("SELECT id, total_amount FROM orders LIMIT 1");
  const got = Number(r.rows[0].total_amount);
  check("訂單金額 = 商品價 × 數量", got === EXPECTED, `期望 ${EXPECTED}，實得 ${got}`);
  await db.close();
}

/* ---------- T2：改價攻擊 A（unit_price 塞 1） ---------- */
async function t2() {
  console.log("\n【T2】改價攻擊 A（order_items.unit_price 刻意填 1）");
  const db = await freshDb();
  const { a } = await ids(db);
  await db.exec(`
    BEGIN;
    INSERT INTO orders (user_id, status, total_amount, identity_type)
      VALUES (gen_random_uuid(), '待處理', ${EXPECTED}, NULL);
    INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
      SELECT id, '${a}', '測試商品A', 1, ${QTY} FROM orders LIMIT 1;
    COMMIT;
  `);
  const ri = await db.query("SELECT unit_price FROM order_items LIMIT 1");
  const up = Number(ri.rows[0].unit_price);
  check("unit_price 被覆蓋為 products.price", up === PRICE_A, `期望 ${PRICE_A}，實得 ${up}`);
  const ro = await db.query("SELECT id, total_amount FROM orders LIMIT 1");
  const got = Number(ro.rows[0].total_amount);
  check("訂單金額未被前端價格污染", got === EXPECTED, `期望 ${EXPECTED}，實得 ${got}`);
  await db.close();
}

/* ---------- T3：改價攻擊 B（orders.total_amount 塞 1） ---------- */
async function t3() {
  console.log("\n【T3】改價攻擊 B（前端偽造 orders.total_amount = 1）");
  const db = await freshDb();
  const { a } = await ids(db);
  await db.exec(`
    INSERT INTO orders (user_id, status, total_amount, identity_type)
      VALUES (gen_random_uuid(), '待處理', 1, NULL);
  `);
  const r0 = await db.query("SELECT id, total_amount FROM orders LIMIT 1");
  const id = r0.rows[0].id;
  const afterInsert = Number(r0.rows[0].total_amount);
  check("訂單主紀錄金額已被歸零", afterInsert === 0, `期望 0，實得 ${afterInsert}`);

  await db.exec(`
    INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
      VALUES ('${id}', '${a}', '測試商品A', ${PRICE_A}, ${QTY});
  `);
  const got = await orderTotal(db, id);
  check("寫入明細後重算為真實金額", got === EXPECTED, `期望 ${EXPECTED}，實得 ${got}`);
  await db.close();
}

/* ---------- T4：真實 checkout 時序（兩次各自提交） ---------- */
async function t4() {
  console.log("\n【T4】真實 checkout 時序（orders 先提交、items 後提交）");
  console.log(
    "     ↳ checkout.html:416 insert orders → :451 insert order_items，兩個獨立 HTTP 請求"
  );
  const db = await freshDb();
  const { a } = await ids(db);
  let err = null;
  let id = null;
  try {
    await db.exec(`
      INSERT INTO orders (user_id, status, total_amount, identity_type)
        VALUES (gen_random_uuid(), '待處理', ${EXPECTED}, NULL);
    `);
    const r = await db.query("SELECT id FROM orders LIMIT 1");
    id = r.rows[0]?.id || null;
  } catch (e) {
    err = e.message;
  }
  check("步驟 a：建立訂單主紀錄", !err, err || "成功");
  if (err) {
    console.log("     ❗ 真實結帳會在第一步就失敗，後續情境無意義，中止 T4");
    await db.close();
    return;
  }

  await db.exec(`
    INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
      VALUES ('${id}', '${a}', '測試商品A', ${PRICE_A}, ${QTY});
  `);
  const got = await orderTotal(db, id);
  check("步驟 b 後金額正確結算", got === EXPECTED, `期望 ${EXPECTED}，實得 ${got}`);
  await db.close();
}

/* ---------- T5：偽造空單 ---------- */
async function t5() {
  console.log("\n【T5】偽造空單（只插 orders，沒任何明細）");
  const db = await freshDb();
  await db.exec(`
    INSERT INTO orders (user_id, status, total_amount, identity_type)
      VALUES (gen_random_uuid(), '待處理', 1, NULL);
  `);
  const r = await db.query("SELECT total_amount FROM orders LIMIT 1");
  const got = Number(r.rows[0].total_amount);
  check("空單金額被歸零（取不到低價商品）", got === 0, `期望 0，實得 ${got}`);
  console.log("     ℹ v2 已知取捨：不再硬擋空單（那是 v1 結帳失敗的元凶），");
  console.log("       配套＝用 SQL 檔末尾的空單查詢定期清理。");
  await db.close();
}

/* ---------- T6：七七地赦單不受影響 ---------- */
async function t6() {
  console.log("\n【T6】七七地赦單（identity_type 非空，人工認定金額）");
  const db = await freshDb();
  await db.exec(`
    INSERT INTO orders (user_id, status, total_amount, identity_type)
      VALUES (gen_random_uuid(), '待處理', 880, '先人');
  `);
  const r = await db.query("SELECT total_amount FROM orders LIMIT 1");
  const got = Number(r.rows[0].total_amount);
  check("人工金額被保留，未被歸零", got === 880, `期望 880，實得 ${got}`);
  await db.close();
}

/* ---------- T7：刪除明細後重算 ---------- */
async function t7() {
  console.log("\n【T7】刪除明細後父單金額重算");
  const db = await freshDb();
  const { a, b } = await ids(db);
  await db.exec(`
    INSERT INTO orders (user_id, status, total_amount, identity_type)
      VALUES (gen_random_uuid(), '待處理', 0, NULL);
  `);
  const r = await db.query("SELECT id FROM orders LIMIT 1");
  const id = r.rows[0].id;
  await db.exec(`
    INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES
      ('${id}', '${a}', '測試商品A', ${PRICE_A}, ${QTY}),
      ('${id}', '${b}', '測試商品B', ${PRICE_B}, 1);
  `);
  const sum2 = PRICE_A * QTY + PRICE_B;
  const got1 = await orderTotal(db, id);
  check("兩筆明細合計正確", got1 === sum2, `期望 ${sum2}，實得 ${got1}`);

  await db.exec(`DELETE FROM order_items WHERE product_id = '${b}';`);
  const got2 = await orderTotal(db, id);
  check("刪除一筆後重算", got2 === EXPECTED, `期望 ${EXPECTED}，實得 ${got2}`);
  await db.close();
}

/* ---------- 主流程 ---------- */
console.log("=================================================================");
console.log("金流防線本地實測 — backend/order_amount_guard.sql（PGlite，純離線）");
console.log("=================================================================");
console.log(`商品A 單價 ${PRICE_A} × ${QTY} = ${EXPECTED}；商品B 單價 ${PRICE_B}`);

await t1();
await t2();
await t3();
await t4();
await t5();
await t6();
await t7();

console.log("\n-----------------------------------------------------------------");
console.log(`結果：${pass} 通過 / ${fail} 失敗`);
console.log("-----------------------------------------------------------------");
process.exitCode = fail ? 1 : 0;
