/**
 * tasks.repository.js —— 任務資料存取層
 *
 * 重點：
 *  1. 所有查詢都帶 user_id 條件，這是「資料隔離」的最後一道防線：
 *     就算上層邏輯出錯，也不可能讀到別人的任務。
 *  2. 全部使用參數化查詢（$1、$2…），絕不字串拼接使用者輸入。
 *  3. 排序欄位走白名單，避免 SQL 注入。
 */
import { query, queryOne } from "../../db/client.js";

const COLUMNS = "id, user_id, title, notes, status, priority, due_date, created_at, updated_at";

const SORT_MAP = {
  created_desc: "created_at DESC",
  created_asc: "created_at ASC",
  due_asc: "due_date ASC NULLS LAST, created_at DESC",
  priority_desc: "priority DESC, created_at DESC",
  updated_desc: "updated_at DESC",
};

/** LIKE 萬用字元跳脫，避免使用者輸入 % 或 _ 造成全表比對 */
export function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (c) => `\\${c}`);
}

function buildFilters({ userId, q, status, priority }) {
  const clauses = ["user_id = $1"];
  const params = [userId];

  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  if (priority !== undefined && priority !== null) {
    params.push(priority);
    clauses.push(`priority = $${params.length}`);
  }
  if (q) {
    params.push(`%${escapeLike(q)}%`);
    // 標題與備註都搜尋，\ 為跳脫字元
    clauses.push(`(title ILIKE $${params.length} ESCAPE '\\' OR COALESCE(notes, '') ILIKE $${params.length} ESCAPE '\\')`);
  }
  return { clause: clauses.join(" AND "), params };
}

export async function listByUser(filters) {
  const { clause, params } = buildFilters(filters);
  const orderBy = SORT_MAP[filters.sort] ?? SORT_MAP.created_desc;

  params.push(filters.limit, filters.offset);
  return query(
    `SELECT ${COLUMNS} FROM tasks
      WHERE ${clause}
      ORDER BY ${orderBy}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
}

export async function countByUser(filters) {
  const { clause, params } = buildFilters(filters);
  const row = await queryOne(`SELECT count(*)::int AS total FROM tasks WHERE ${clause}`, params);
  return row?.total ?? 0;
}

export function findByIdAndUser(id, userId) {
  return queryOne(`SELECT ${COLUMNS} FROM tasks WHERE id = $1 AND user_id = $2`, [id, userId]);
}

export function findById(id) {
  return queryOne(`SELECT ${COLUMNS} FROM tasks WHERE id = $1`, [id]);
}

export function insert({ userId, title, notes, status, priority, dueDate }) {
  return queryOne(
    `INSERT INTO tasks (user_id, title, notes, status, priority, due_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [userId, title, notes ?? null, status, priority, dueDate ?? null]
  );
}

/**
 * 部分更新：只更新有給的欄位
 * @returns {Promise<object|null>} 更新後的列；找不到回傳 null
 */
export async function update(id, userId, patch) {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return findByIdAndUser(id, userId);

  const sets = [];
  const params = [];
  entries.forEach(([column, value], i) => {
    sets.push(`${column} = $${i + 1}`);
    params.push(value);
  });
  params.push(id, userId);

  return queryOne(
    `UPDATE tasks SET ${sets.join(", ")}, updated_at = now()
      WHERE id = $${params.length - 1} AND user_id = $${params.length}
      RETURNING ${COLUMNS}`,
    params
  );
}

export function remove(id, userId) {
  return queryOne("DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
}

export function removeById(id) {
  return queryOne("DELETE FROM tasks WHERE id = $1 RETURNING id", [id]);
}

export async function statsByUser(userId) {
  const row = await queryOne(
    `SELECT
       count(*)::int AS total,
       count(*) FILTER (WHERE status = 'todo')::int  AS todo,
       count(*) FILTER (WHERE status = 'doing')::int AS doing,
       count(*) FILTER (WHERE status = 'done')::int  AS done
     FROM tasks WHERE user_id = $1`,
    [userId]
  );
  return row ?? { total: 0, todo: 0, doing: 0, done: 0 };
}
