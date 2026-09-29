// 只读验证 service_role 密钥是否可用（仅 GET，不写库）
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "scripts", ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const URL = process.env.SUPABASE_URL, SECRET = process.env.SUPABASE_SECRET_KEY;
const r = await fetch(`${URL}/rest/v1/products?select=count&limit=1`, {
  headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
});
console.log("HTTP", r.status);
if (r.ok) {
  const rows = await r.json();
  console.log("service_role 密钥可用，products 读取成功，返回:", JSON.stringify(rows).slice(0, 120));
} else {
  console.log("密钥可能无效，响应:", await r.text().catch(() => "n/a"));
}
