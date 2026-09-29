const SUPABASE_URL = "https://tfyxaesejdfxykdalcsj.supabase.co";
const ANON = "sb_publishable_Sa-csa_ReGMUprDwE1eNow_vtXyYfH0";
const H = { "apikey": ANON, "Authorization": `Bearer ${ANON}` };

async function probe(path, label) {
  const url = `${SUPABASE_URL}/rest/v1/${path}?select=*&limit=1`;
  try {
    const r = await fetch(url, { headers: H });
    const body = await r.text();
    console.log(`\n### ${label} [${r.status}]`);
    console.log(body.slice(0, 300));
  } catch (e) {
    console.log(`\n### ${label} ERR ${e.message}`);
  }
}

// 也 dump OpenAPI 暴露了哪些路径
try {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${ANON}`, { headers: H });
  const spec = await r.json();
  const paths = Object.keys(spec.paths || {});
  console.log("OPENAPI VERSION:", spec.openapi || spec.swagger);
  console.log("EXPOSED PATHS COUNT:", paths.length);
  console.log("order/prod/cart related:", paths.filter(p => /order|product|cart|profile|shipping|favorite/i.test(p)).join("  "));
  console.log("ALL PATHS:", paths.join("  "));
} catch (e) { console.log("SPEC ERR", e.message); }

await probe("products", "products (anon read)");
await probe("orders", "orders (anon read)");
await probe("cart_items", "cart_items (anon read)");
await probe("categories", "categories (anon read)");
