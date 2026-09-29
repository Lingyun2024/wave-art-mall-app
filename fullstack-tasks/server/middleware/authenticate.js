/**
 * authenticate.js —— 存取權杖驗證中介層
 *
 * 流程：
 *   1. 取 Authorization: Bearer <token>
 *   2. 驗證簽章與時效（JWT 層）
 *   3. 到資料庫確認使用者仍存在且未被停用（帳號可被即時停權，不需等權杖過期）
 *   4. 把精簡的使用者資訊掛到 req.user，供後續控制器使用
 */
import { config } from "../config.js";
import { UnauthorizedError, ForbiddenError } from "../errors.js";
import { verifyToken } from "../lib/jwt.js";
import { findUserById } from "../modules/auth/auth.repository.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.header("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    throw new UnauthorizedError("缺少登入憑證", "MISSING_TOKEN");
  }

  let claims;
  try {
    claims = verifyToken(match[1].trim(), config.jwt, "access");
  } catch {
    throw new UnauthorizedError("登入憑證無效或已過期", "TOKEN_INVALID");
  }

  const user = await findUserById(claims.sub);
  if (!user) throw new UnauthorizedError("使用者不存在", "USER_NOT_FOUND");
  if (!user.is_active) throw new UnauthorizedError("此帳號已被停用", "ACCOUNT_DISABLED");

  req.user = { id: user.id, email: user.email, role: user.role, displayName: user.display_name };
  next();
});

/** 角色檢查，必須掛在 authenticate 之後 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) throw new UnauthorizedError("請先登入");
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError("需要管理員權限才能執行此操作");
    }
    next();
  };
}
