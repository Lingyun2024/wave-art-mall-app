/**
 * admin.service.js —— 管理後台業務邏輯
 *
 * 兩條自我保護規則：
 *  1. 管理員不能把自己停用或降級，避免把自己鎖在門外。
 *  2. 角色的值只能是 member / admin，由白名單控制。
 */
import { BadRequestError, NotFoundError } from "../../errors.js";
import { parse, parsePagination } from "../../lib/validate.js";
import * as repo from "./admin.repository.js";

export function toAdminUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export function toAdminTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    ownerEmail: row.owner_email,
    title: row.title,
    notes: row.notes,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : null,
    createdAt: row.created_at,
  };
}

export async function overview() {
  const row = await repo.overview();
  return {
    users: { total: row.users_total, active: row.users_active, admins: row.users_admin },
    tasks: { total: row.tasks_total, todo: row.tasks_todo, doing: row.tasks_doing, done: row.tasks_done },
    activeSessions: row.active_sessions,
  };
}

export async function listUsers(query) {
  const { page, pageSize, offset } = parsePagination(query);
  const q = typeof query.q === "string" && query.q.trim() ? query.q.trim().slice(0, 100) : undefined;
  const rows = await repo.listUsers({ limit: pageSize, offset, q });
  const total = await repo.countUsers();
  return {
    items: rows.map(toAdminUser),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function listTasks(query) {
  const { page, pageSize, offset } = parsePagination(query);
  const q = typeof query.q === "string" && query.q.trim() ? query.q.trim().slice(0, 100) : undefined;
  const status = ["todo", "doing", "done"].includes(query.status) ? query.status : undefined;

  const [rows, total] = await Promise.all([
    repo.listAllTasks({ limit: pageSize, offset, q, status }),
    repo.countAllTasks({ q, status }),
  ]);
  return {
    items: rows.map(toAdminTask),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

const patchUserSchema = {
  isActive: { type: "boolean" },
  role: { type: "string", oneOf: ["member", "admin"] },
};

export async function updateUser(actorId, targetId, input) {
  const dto = parse(input ?? {}, patchUserSchema);
  if (dto.isActive === undefined && dto.role === undefined) {
    throw new BadRequestError("必須提供 isActive 或 role");
  }
  if (targetId === actorId && (dto.isActive === false || dto.role === "member")) {
    throw new BadRequestError("不能停用或降級自己的帳號");
  }

  const patch = {};
  if (dto.isActive !== undefined) patch.is_active = dto.isActive;
  if (dto.role !== undefined) patch.role = dto.role;

  const row = await repo.updateUser(targetId, patch);
  if (!row) throw new NotFoundError("找不到這個使用者");
  return toAdminUser(row);
}

export async function deleteTask(taskId) {
  const row = await repo.deleteTask(taskId);
  if (!row) throw new NotFoundError("找不到這筆任務");
  return { id: row.id };
}
