-- =========================================================
-- 001_init.sql —— 初始 schema（users / tasks / refresh_tokens）
-- =========================================================
-- 遷移檔格式规定：
--   「UP」區段位於下方的 -- ===== UP ===== 之後，為建立表格的升級語句
--   「DOWN」區段位於 -- ===== DOWN ===== 之後，為移除表格的回滾語句
-- 兩個區段都必須存在，讓每一次 schema 變動都可回復。

-- ===== UP =====

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name  text NOT NULL,
  role          text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  notes      text,
  status     text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  priority   smallint NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  due_date   date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 列表查詢固定是「某使用者的任務，依建立時間新到舊」，複合索引最有效
CREATE INDEX IF NOT EXISTS idx_tasks_user_created ON tasks (user_id, created_at DESC);
-- 狀態篩選
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks (user_id, status);
-- 標題模糊搜尋（pg_trim 尚未安裝，先用 btree 支援前綴比對；全文檢索留待後續遷移）
CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks (title);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at);

-- ===== DOWN =====

DROP INDEX IF EXISTS idx_refresh_tokens_expires;
DROP INDEX IF EXISTS idx_refresh_tokens_user;
DROP TABLE IF EXISTS refresh_tokens;
DROP INDEX IF EXISTS idx_tasks_title;
DROP INDEX IF EXISTS idx_tasks_user_status;
DROP INDEX IF EXISTS idx_tasks_user_created;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS users;
