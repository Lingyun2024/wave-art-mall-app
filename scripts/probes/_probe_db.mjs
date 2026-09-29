const URL = "https://tfyxaesejdfxykdalcsj.supabase.co";
const KEY = "sb_publishable_Sa-csa_ReGMUprDwE1eNow_vtXyYfH0";
const tables = ["categories","products","artists","flash_sales","profiles","cart_items","favorites","orders","order_items","shipping_addresses"];

async function probe(t){
  const headers = { "apikey": KEY, "Authorization": `Bearer ${KEY}` };
  try {
    const r = await fetch(`${URL}/rest/v1/${t}?select=*&limit=1`, { headers });
    const body = await r.text();
    let parsed = null; try { parsed = JSON.parse(body); } catch {}
    let contentRange = null;
    try {
      const rc = await fetch(`${URL}/rest/v1/${t}?select=count&limit=1`, { headers: { ...headers, "Prefer": "count=exact" } });
      contentRange = rc.headers.get("content-range");
    } catch {}
    return { table: t, status: r.status, bodyLen: body.length, sample: parsed, contentRange };
  } catch(e){ return { table:t, error: String(e) }; }
}

(async () => {
  for (const t of tables){
    const res = await probe(t);
    console.log(JSON.stringify(res));
  }
})();
