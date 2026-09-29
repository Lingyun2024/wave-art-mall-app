// 只读探针：用用户给的 anon key 通过 Supabase REST (PostgREST) 测试能读到哪些表
const SUPABASE_URL = "https://tfyxaesejdfxykdalcsj.supabase.co";
const ANON_KEY = "sb_publishable_Sa-csa_ReGMUprDwE1eNow_vtXyYfH0";

const TABLES = [
  "categories", "products", "artists", "flash_sales",
  "profiles", "orders", "order_items", "cart_items", "favorites", "shipping_addresses"
];

async function countRows(table) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
  );
  if (!r.ok) return `ERR ${r.status} ${await r.text().catch(() => "")}`;
  const rows = await r.json();
  return `OK rows=${Array.isArray(rows) ? rows.length : "?"}`;
}

(async () => {
  console.log("=== REST 只读探针（anon key）===");
  for (const t of TABLES) {
    try {
      const res = await countRows(t);
      console.log(`${t.padEnd(20)} ${res}`);
    } catch (e) {
      console.log(`${t.padEnd(20)} EXC ${e.message}`);
    }
  }
})();
