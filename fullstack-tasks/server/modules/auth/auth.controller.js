/**
 * auth.controller.js —— 認證相關 HTTP 端點
 *
 * 控制器只做三件事：解析請求 → 呼叫 service → 格式化回應。
 * 業務規則一律在 service，SQL 一律在 repository，這裡不寫任何邏輯。
 */
import { asyncHandler } from "../../lib/asyncHandler.js";
import * as authService from "./auth.service.js";

function metaFrom(req) {
  return { userAgent: req.header("User-Agent") };
}

export const register = asyncHandler(async (req, res) => {
  const { user, tokens } = await authService.register(req.body, metaFrom(req));
  res.status(201).json({ user, ...tokens });
});

export const login = asyncHandler(async (req, res) => {
  const { user, tokens } = await authService.login(req.body, metaFrom(req));
  res.json({ user, ...tokens });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.body?.refreshToken ?? req.header("X-Refresh-Token");
  const { user, tokens } = await authService.refresh(token, metaFrom(req));
  res.json({ user, ...tokens });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.body?.refreshToken);
  res.status(204).end();
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: await authService.getMe(req.user.id) });
});
