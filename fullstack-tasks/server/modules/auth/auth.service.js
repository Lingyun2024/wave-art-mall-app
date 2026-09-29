/**
 * auth.service.js —— 認證業務邏輯
 *
 * 規則：
 *  1. 註冊永遠只能拿到 member 角色，避免任何人自我提權成 admin。
 *  2. 密碼只以雜湊儲存，驗證失敗回傳同一則訊息（不洩漏帳號是否存在）。
 *  3. 刷新權杖存的是雜湊值，且每次刷新都「輪換」：舊權杖立即作廢，
 *     一旦舊權杖被拿來重用（可能已外洩），整批權杖直接撤銷。
 */
import { createHash } from "node:crypto";
import { config } from "../../config.js";
import { logger } from "../../logger.js";
import { ConflictError, UnauthorizedError, isUniqueViolation } from "../../errors.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { signToken, verifyToken } from "../../lib/jwt.js";
import { parse } from "../../lib/validate.js";
import * as repo from "./auth.repository.js";

/** 對外永遠回傳這個形狀，不含任何敏感欄位 */
export function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    isActive: user.is_active,
    createdAt: user.created_at,
  };
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

/** 簽發一組 access + refresh，並把 refresh 的雜湊寫入資料庫 */
async function issueTokenPair(user, userAgent) {
  const access = signToken({ sub: user.id, role: user.role, typ: "access" }, config.jwt, config.jwt.accessTtlSeconds);
  const refresh = signToken({ sub: user.id, role: user.role, typ: "refresh" }, config.jwt, config.jwt.refreshTtlSeconds);

  await repo.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refresh.token),
    expiresAt: new Date(Date.now() + config.jwt.refreshTtlSeconds * 1000).toISOString(),
    userAgent,
  });

  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    expiresIn: config.jwt.accessTtlSeconds,
  };
}

const registerSchema = {
  email: { type: "string", required: true, email: true, max: 254 },
  password: { type: "string", required: true, min: 8, max: 128 },
  displayName: { type: "string", required: true, min: 1, max: 60 },
};

const loginSchema = {
  email: { type: "string", required: true, email: true, max: 254 },
  password: { type: "string", required: true, max: 128 },
};

export async function register(input, meta = {}) {
  const dto = parse(input, registerSchema);
  const passwordHash = await hashPassword(dto.password, config.password.scryptKeylen);

  let user;
  try {
    // 角色固定 member：不開放客戶端指定
    user = await repo.createUser({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
      role: "member",
    });
  } catch (err) {
    if (isUniqueViolation(err, "users_email")) {
      throw new ConflictError("這個 Email 已經註冊過了", "EMAIL_TAKEN");
    }
    throw err;
  }

  const tokens = await issueTokenPair(user, meta.userAgent);
  logger.info("使用者註冊成功", { userId: user.id });
  return { user: toPublicUser(user), tokens };
}

export async function login(input, meta = {}) {
  const dto = parse(input, loginSchema);
  const user = await repo.findUserByEmail(dto.email);

  // 找不到使用者也跑一次雜湊比對，讓回應時間一致（避免列舉帳號）
  const ok = user
    ? await verifyPassword(dto.password, user.password_hash)
    : await verifyPassword(dto.password, "scrypt$00$00");

  if (!ok || !user) throw new UnauthorizedError("Email 或密碼錯誤", "INVALID_CREDENTIALS");
  if (!user.is_active) throw new UnauthorizedError("此帳號已被停用", "ACCOUNT_DISABLED");

  const tokens = await issueTokenPair(user, meta.userAgent);
  logger.info("使用者登入成功", { userId: user.id });
  return { user: toPublicUser(user), tokens };
}

export async function refresh(rawToken, meta = {}) {
  if (!rawToken) throw new UnauthorizedError("缺少刷新權杖", "MISSING_REFRESH_TOKEN");

  let claims;
  try {
    claims = verifyToken(rawToken, config.jwt, "refresh");
  } catch (err) {
    throw new UnauthorizedError("刷新權杖無效或已過期", "INVALID_REFRESH_TOKEN");
  }

  const stored = await repo.findRefreshTokenByHash(hashToken(rawToken));

  // 權杖不在資料庫 → 可能已被輪換掉或遭竊用，直接撤銷該使用者全部權杖
  if (!stored) {
    logger.warn("偵測到未登記的刷新權杖，撤銷該使用者全部權杖", { userId: claims.sub });
    await repo.revokeAllRefreshTokensForUser(claims.sub);
    throw new UnauthorizedError("刷新權杖已失效，請重新登入", "REFRESH_TOKEN_REUSED");
  }
  if (stored.revoked_at) {
    await repo.revokeAllRefreshTokensForUser(stored.user_id);
    throw new UnauthorizedError("刷新權杖已失效，請重新登入", "REFRESH_TOKEN_REUSED");
  }
  if (new Date(stored.expires_at).getTime() <= Date.now()) {
    throw new UnauthorizedError("刷新權杖已過期", "REFRESH_TOKEN_EXPIRED");
  }

  const user = await repo.findUserById(stored.user_id);
  if (!user || !user.is_active) throw new UnauthorizedError("帳號不存在或已停用", "ACCOUNT_DISABLED");

  // 輪換：作廢舊的，發新的
  await repo.revokeRefreshToken(stored.id);
  const tokens = await issueTokenPair(user, meta.userAgent);
  return { user: toPublicUser(user), tokens };
}

export async function logout(rawToken) {
  if (!rawToken) return { ok: true };
  const stored = await repo.findRefreshTokenByHash(hashToken(rawToken));
  if (stored && !stored.revoked_at) await repo.revokeRefreshToken(stored.id);
  return { ok: true };
}

export async function getMe(userId) {
  const user = await repo.findUserById(userId);
  if (!user) throw new UnauthorizedError("找不到使用者", "USER_NOT_FOUND");
  return toPublicUser(user);
}
