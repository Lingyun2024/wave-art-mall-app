/**
 * auth.repository.js —— 使用者與刷新權杖的資料存取層
 *
 * 這一層只做「怎麼查、怎麼寫」，不含任何業務規則與 HTTP 概念，
 * 因此可以被 service 直接呼叫，也能在測試裡單獨驗證 SQL 行為。
 */
import { query, queryOne } from "../../db/client.js";

const USER_COLUMNS = "id, email, password_hash, display_name, role, is_active, created_at, updated_at";

export function findUserByEmail(email) {
  return queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [String(email).toLowerCase()]);
}

export function findUserById(id) {
  return queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
}

export function createUser({ email, passwordHash, displayName, role = "member" }) {
  return queryOne(
    `INSERT INTO users (email, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${USER_COLUMNS}`,
    [String(email).toLowerCase(), passwordHash, displayName, role]
  );
}

export function countUsers() {
  return queryOne("SELECT count(*)::int AS total FROM users").then((r) => r?.total ?? 0);
}

export function createRefreshToken({ userId, tokenHash, expiresAt, userAgent }) {
  return queryOne(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, expires_at, revoked_at`,
    [userId, tokenHash, expiresAt, userAgent ?? null]
  );
}

export function findRefreshTokenByHash(tokenHash) {
  return queryOne("SELECT * FROM refresh_tokens WHERE token_hash = $1", [tokenHash]);
}

export function revokeRefreshToken(id, revokedAt = new Date().toISOString()) {
  return queryOne(
    "UPDATE refresh_tokens SET revoked_at = $2 WHERE id = $1 RETURNING id",
    [id, revokedAt]
  );
}

export function revokeAllRefreshTokensForUser(userId) {
  return query("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL RETURNING id", [userId]);
}
