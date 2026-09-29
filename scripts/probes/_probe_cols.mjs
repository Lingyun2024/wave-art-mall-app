const SUPABASE_URL = "https://tfyxaesejdfxykdalcsj.supabase.co";
const ANON = "sb_publishable_Sa-csa_ReGMUprDwE1eNow_vtXyYfH0";
const H = { "apikey": ANON, "Authorization": `Bearer ${ANON}` };

// 测试某表是否能 select 给定列；能读([]或数据)=列存在，400错误=列不存在
async function testCols(table, cols) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${cols}&limit=1`;
  const r = await fetch(url, { headers: H });
  const body = await r.text();
  const ok = r.status === 200;
  console.log(`[${ok ? "EXISTS " : "MISSING"}] ${table} <- ${cols}`);
  if (!ok) console.log("        msg:", body.slice(0, 160));
}

await testCols("orders", "receiver_name,receiver_address,receiver_phone");
await testCols("orders", "recipient_name,street_address,phone,city,district");
await testCols("orders", "status,total_amount,payment_method,user_id,order_number");
await testCols("order_items", "product_image");
await testCols("order_items", "product_image_url,subtotal");
await testCols("order_items", "order_id,product_id,product_name,unit_price,quantity");
