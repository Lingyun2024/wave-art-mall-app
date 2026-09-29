/**
 * tasks.controller.js —— 任務 HTTP 端點
 * GET    /api/tasks          列表（搜尋 / 篩選 / 分頁 / 排序）
 * POST   /api/tasks          新增
 * GET    /api/tasks/:id      單筆
 * PATCH  /api/tasks/:id      部分更新
 * DELETE /api/tasks/:id      刪除
 */
import { asyncHandler } from "../../lib/asyncHandler.js";
import * as tasksService from "./tasks.service.js";

export const list = asyncHandler(async (req, res) => {
  const result = await tasksService.list(req.user.id, req.query);
  res.json(result);
});

export const create = asyncHandler(async (req, res) => {
  const task = await tasksService.create(req.user.id, req.body);
  res.status(201).json({ task });
});

export const get = asyncHandler(async (req, res) => {
  res.json({ task: await tasksService.get(req.user.id, req.params.id) });
});

export const update = asyncHandler(async (req, res) => {
  res.json({ task: await tasksService.update(req.user.id, req.params.id, req.body) });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await tasksService.remove(req.user.id, req.params.id);
  res.json(result);
});
