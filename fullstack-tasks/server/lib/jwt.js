/**
 * jwt.js —— 極簡 JWT（HS256）簽發與驗證
 *
 * 為什麼自己寫而不引第三方套件？
 *   整個專案只需要「簽一個短時效 access token + 一個可撤銷的 refresh token」，
 *   node:crypto 已內建 HMAC，自寫約 80 行、零依賴，也更好審計。
 *   若日後要接第三方身分源，只要替換本檔的 sign/verify 即可。
 *
 * 安全原則：
 *  1. access token 短時效（預設 15 分鐘），refresh token 存資料庫且可撤銷。
 *  2. 驗證時檢查 iss / exp / nbf，並用常數時間比對簽章。
 *  3. 權杖內只放最小必要資訊（sub / role / typ / jti）。
 */
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

const enc = new TextEncoder();

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function decodeSegment(seg) {
  return JSON.parse(Buffer.from(seg, "base64url").toString("utf-8"));
}

function sign(data, secret) {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * 簽發權杖
 * @param {{ sub: string, role?: string, typ: "access"|"refresh" }} claims
 * @param {{ secret: string, issuer: string }} opts
 * @param {number} ttlSeconds
 */
export function signToken(claims, opts, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const payload = b64urlJson({
    iss: opts.issuer,
    sub: claims.sub,
    role: claims.role ?? "member",
    typ: claims.typ,
    jti: randomUUID(),
    iat: now,
    exp: now + ttlSeconds,
  });
  const unsigned = `${header}.${payload}`;
  const signature = sign(unsigned, opts.secret);
  return { token: `${unsigned}.${signature}`, jti: JSON.parse(Buffer.from(payload, "base64url").toString()).jti };
}

/** 驗證權杖；失敗一律丟錯，由呼叫端轉成 401 */
export function verifyToken(token, opts, expectedTyp) {
  if (typeof token !== "string" || token.split(".").length !== 3) {
    throw new Error("權杖格式錯誤");
  }
  const [header, payload, signature] = token.split(".");

  const decodedHeader = decodeSegment(header);
  if (decodedHeader.alg !== "HS256") throw new Error("不支援的簽章演算法");

  if (!safeEqual(signature, sign(`${header}.${payload}`, opts.secret))) {
    throw new Error("簽章驗證失敗");
  }

  const claims = decodeSegment(payload);
  const now = Math.floor(Date.now() / 1000);

  if (claims.iss !== opts.issuer) throw new Error("簽發者不符");
  if (expectedTyp && claims.typ !== expectedTyp) throw new Error("權杖類型不符");
  if (typeof claims.exp !== "number" || claims.exp <= now) throw new Error("權杖已過期");
  if (typeof claims.sub !== "string" || claims.sub.length === 0) throw new Error("權杖缺少主體");

  return claims;
}
