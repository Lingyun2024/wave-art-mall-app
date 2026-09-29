/**
 * admin.controller.js —— 管理後台端點（全部需要 admin 角色）
 * GET    /api/admin/overview     全站統計
 * GET    /api/admin/users        使用者列表
 * PATCH  /api/admin/users/:id    停用/啟用、調整角色
 * GET    /api/admin/tasks        全站任務
 * DELETE /api/admin/tasks/:id    刪除任一使用者的任務
 */
import { asyncHandler } from "../../lib/asyncHandler.js";
import * as adminService from "./admin.service.js";

export const overview = asyncHandler(async (req, res) => {
  res.json(await adminService.overview());
});

export const listUsers = asyncHandler(async (req, res) => {
  res.json(await adminService.listUsers(req.query));
});

export const updateUser = asyncHandler(async (req, res) => {
  res.json({ user: await adminService.updateUser(req.user.id, req.params.id, req.body) });
});

export const listTasks = asyncHandler(async (req, res) => {
  res.json(await adminService.listTasks(req.query));
});

export const deleteTask = asyncHandler(async (req, res) => {
  res.json(await adminService.deleteTask(req.params.id));
});
