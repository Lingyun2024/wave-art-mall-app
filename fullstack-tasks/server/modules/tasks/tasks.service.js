/**
 * tasks.service.js —— 任務業務邏輯
 *
 * 負責：輸入驗證 → 呼叫 repository → 找不到就轉成 404。
 * 不碰 req / res，因此可以直接被單元測試呼叫。
 */
import { NotFoundError } from "../../errors.js";
import { parse, parsePagination } from "../../lib/validate.js";
import * as repo from "./tasks.repository.js";

export function toTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    notes: row.notes,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const createSchema = {
  title: { type: "string", required: true, min: 1, max: 120 },
  notes: { type: "string", max: 2000 },
  status: { type: "string", oneOf: ["todo", "doing", "done"], default: "todo" },
  priority: { type: "number", int: true, min: 1, max: 3, default: 2 },
  dueDate: { type: "date" },
};

const updateSchema = {
  title: { type: "string", min: 1, max: 120 },
  notes: { type: "string", max: 2000 },
  status: { type: "string", oneOf: ["todo", "doing", "done"] },
  priority: { type: "number", int: true, min: 1, max: 3 },
  dueDate: { type: "date" },
};

const ALLOWED_SORTS = ["created_desc", "created_asc", "due_asc", "priority_desc", "updated_desc"];

export async function list(userId, rawQuery = {}) {
  // q / status / priority / sort 用寬鬆解析：不合法就忽略，不讓使用者看到 400
  const filters = {
    userId,
    q: typeof rawQuery.q === "string" && rawQuery.q.trim() ? rawQuery.q.trim().slice(0, 100) : undefined,
    status: ["todo", "doing", "done"].includes(rawQuery.status) ? rawQuery.status : undefined,
    priority: Number.isInteger(Number(rawQuery.priority)) && rawQuery.priority !== undefined && String(rawQuery.priority) !== ""
      ? Math.min(3, Math.max(1, Number(rawQuery.priority)))
      : undefined,
    sort: ALLOWED_SORTS.includes(rawQuery.sort) ? rawQuery.sort : "created_desc",
  };

  const { page, pageSize, offset } = parsePagination(rawQuery);
  const [rows, total, stats] = await Promise.all([
    repo.listByUser({ ...filters, limit: pageSize, offset }),
    repo.countByUser(filters),
    repo.statsByUser(userId),
  ]);

  return {
    items: rows.map(toTask),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    stats,
  };
}

export async function get(userId, id) {
  const row = await repo.findByIdAndUser(id, userId);
  if (!row) throw new NotFoundError("找不到這筆任務");
  return toTask(row);
}

export async function create(userId, input) {
  const dto = parse(input ?? {}, createSchema);
  const row = await repo.insert({
    userId,
    title: dto.title,
    notes: dto.notes ?? null,
    status: dto.status ?? "todo",
    priority: dto.priority ?? 2,
    dueDate: dto.dueDate ?? null,
  });
  return toTask(row);
}

export async function update(userId, id, input) {
  const dto = parse(input ?? {}, updateSchema);
  if (Object.keys(dto).length === 0) throw new NotFoundError("沒有提供任何要更新的欄位");

  const patch = {};
  if (dto.title !== undefined) patch.title = dto.title;
  if (dto.notes !== undefined) patch.notes = dto.notes;
  if (dto.status !== undefined) patch.status = dto.status;
  if (dto.priority !== undefined) patch.priority = dto.priority;
  if (dto.dueDate !== undefined) patch.due_date = dto.dueDate;

  const row = await repo.update(id, userId, patch);
  if (!row) throw new NotFoundError("找不到這筆任務");
  return toTask(row);
}

export async function remove(userId, id) {
  const row = await repo.remove(id, userId);
  if (!row) throw new NotFoundError("找不到這筆任務");
  return { id };
}
