const SUPABASE_URL = "https://tfyxaesejdfxykdalcsj.supabase.co";
const ANON = "sb_publishable_Sa-csa_ReGMUprDwE1eNow_vtXyYfH0";
const url = `${SUPABASE_URL}/rest/v1/?apikey=${ANON}`;
try {
  const r = await fetch(url, { headers: { "apikey": ANON, "Authorization": `Bearer ${ANON}` } });
  const spec = await r.json();
  const paths = spec.paths || {};
  const want = ["orders","order_items","cart_items","shipping_addresses","profiles"];
  for (const t of want) {
    const p = paths["/"+t];
    if (!p) { console.log(`\n### ${t}: (not exposed)`); continue; }
    const post = p.post;
    const props = post && post.requestBody ? post.requestBody.content["application/json"].schema.properties : null;
    const cols = props ? Object.keys(props) : "(no post body def)";
    console.log(`\n### ${t} columns:`);
    console.log(cols.join(", "));
  }
} catch (e) { console.error("ERR", e.message); }
