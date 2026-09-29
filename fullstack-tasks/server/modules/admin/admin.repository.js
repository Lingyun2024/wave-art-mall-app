/**
 * admin.repository.js —— 管理後台的跨使用者資料查詢
 *
 * 這裡的查詢刻意「不帶 user_id 條件」，因為管理員本來就需要看到全站資料；
 * 因此所有入口都必須由 requireRole("admin") 守住（見 admin 路由）。
 */
import { query, queryOne } from "../../db/client.js";

const USER_COLUMNS = "id, email, display_name, role, is_active, created_at";
const TASK_COLUMNS = "id, user_id, title, notes, status, priority, due_date, created_at, updated_at";

export async function countUsers() {
  const row = await queryOne("SELECT count(*)::int AS total FROM users");
  return row?.total ?? 0;
}

export async function listUsers({ limit, offset, q }) {
  const params = [];
  let clause = "";
  if (q) {
    params.push(`%${String(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    clause = `WHERE email ILIKE $1 ESCAPE '\\' OR display_name ILIKE $1 ESCAPE '\\'`;
  }
  params.push(limit, offset);
  return query(
    `SELECT ${USER_COLUMNS} FROM users
     ${clause}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
}

export function updateUser(id, patch) {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return findUser(id);

  const sets = entries.map(([col], i) => `${col} = $${i + 1}`);
  const params = entries.map(([, v]) => v);
  params.push(id);

  return queryOne(
    `UPDATE users SET ${sets.join(", ")}, updated_at = now()
      WHERE id = $${params.length}
      RETURNING ${USER_COLUMNS}`,
    params
  );
}

export function findUser(id) {
  return queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
}

export async function listAllTasks({ limit, offset, q, status }) {
  const clauses = [];
  const params = [];

  if (status) {
    params.push(status);
    clauses.push(`t.status = $${params.length}`);
  }
  if (q) {
    params.push(`%${String(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    clauses.push(`(t.title ILIKE $${params.length} ESCAPE '\\' OR COALESCE(t.notes, '') ILIKE $${params.length} ESCAPE '\\')`);
  }

  params.push(limit, offset);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  return query(
    `SELECT ${TASK_COLUMNS.split(", ")
      .map((c) => `t.${c}`)
      .join(", ")}, u.email AS owner_email
     FROM tasks t
     JOIN users u ON u.id = t.user_id
     ${where}
     ORDER BY t.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
}

export async function countAllTasks({ q, status }) {
  const clauses = [];
  const params = [];
  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  if (q) {
    params.push(`%${String(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    clauses.push(`(title ILIKE $${params.length} ESCAPE '\\' OR COALESCE(notes, '') ILIKE $${params.length} ESCAPE '\\')`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const row = await queryOne(`SELECT count(*)::int AS total FROM tasks ${where}`, params);
  return row?.total ?? 0;
}

/** 全站統計：一次查詢拿齊，避免 N+1 */
export async function overview() {
  const row = await queryOne(`
    SELECT
      (SELECT count(*)::int FROM users)                                   AS users_total,
      (SELECT count(*)::int FROM users WHERE is_active)                    AS users_active,
      (SELECT count(*)::int FROM users WHERE role = 'admin')               AS users_admin,
      (SELECT count(*)::int FROM tasks)                                    AS tasks_total,
      (SELECT count(*)::int FROM tasks WHERE status = 'todo')              AS tasks_todo,
      (SELECT count(*)::int FROM tasks WHERE status = 'doing')             AS tasks_doing,
      (SELECT count(*)::int FROM tasks WHERE status = 'done')              AS tasks_done,
      (SELECT count(*)::int FROM refresh_tokens WHERE revoked_at IS NULL)  AS active_sessions
  `);
  return row;
}

export function deleteTask(id) {
  return queryOne("DELETE FROM tasks WHERE id = $1 RETURNING id", [id]);
}
