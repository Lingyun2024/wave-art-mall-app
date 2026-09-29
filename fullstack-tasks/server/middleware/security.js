/**
 * security.js —— CORS 與安全標頭
 *
 * 要點：
 *  - CORS 只用「明確來源白名單」，生產環境絕不使用 * ，
 *    且帶憑證時不能回 * ，否則瀏覽器會直接擋掉。
 *  - 加上基本安全標頭（X-Content-Type-Options / X-Frame-Options / Referrer-Policy）。
 */
import { config } from "../config.js";

export function cors() {
  const allowed = new Set(config.corsOrigins);

  return (req, res, next) => {
    const origin = req.header("Origin");

    if (origin && allowed.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Max-Age", "86400");
    }

    if (req.method === "OPTIONS") {
      // 來源不在白名單時，直接結束預檢請求（瀏覽器會視為失敗）
      return res.status(origin && !allowed.has(origin) ? 403 : 204).end();
    }
    next();
  };
}

export function securityHeaders() {
  return (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    next();
  };
}
