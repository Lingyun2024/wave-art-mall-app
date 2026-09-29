-- ============================================================
-- WAVE ART MALL - 七七地赦 (MD_SP) 上線補丁
-- ============================================================
-- 本檔用於「線上 Supabase」執行。
-- 原因：前端用的 anon key 沒有 ALTER TABLE / CREATE POLICY 權限，
--       所以本地改了 supabase-schema.sql 不會自動同步到雲端。
-- 作法：登入 Supabase 後台 → SQL Editor → 貼上本檔 → Run。
-- 執行後：地赦訂單才會真正落庫，且背景名冊頁 admin-roster.html
--         才能跨用戶查到所有報名資料。
-- ============================================================

-- 1) orders 表新增地赦專屬欄位（皆為 nullable，不影響既有一般訂單）
ALTER TABLE orders ADD COLUMN IF NOT EXISTS identity_type VARCHAR(30);   -- personal/family/business/society/savior/heritage
ALTER TABLE orders ADD COLUMN IF NOT EXISTS age INTEGER;                 -- 虛歲
ALTER TABLE orders ADD COLUMN IF NOT EXISTS agent_name VARCHAR(100);     -- 代理人
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transfer_note VARCHAR(20);   -- 匯款後五碼

UPDATE orders
SET
    agent_name = '魏正隆',
    customer_note = regexp_replace(COALESCE(customer_note, ''), '代理人[:：]陳幸容', '代理人:魏正隆', 'g')
WHERE recipient_name = '謝幸汝';

-- 2) 管理員（名冊頁 admin-roster.html）可跨用戶檢視 / 更新訂單
--    ⚠️ 請將下方 Email 換成你實際的管理員帳號
DROP POLICY IF EXISTS "Users can update own pending orders" ON orders;
CREATE POLICY "Users can update own pending orders"
    ON orders FOR UPDATE
    USING (auth.uid() = user_id AND payment_status = 'pending')
    WITH CHECK (auth.uid() = user_id AND payment_status = 'pending');

DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
CREATE POLICY "Admins can view all orders"
    ON orders FOR SELECT
    USING ((auth.jwt() ->> 'email') = '2022lingyun@gmail.com');

DROP POLICY IF EXISTS "Admins can update orders" ON orders;
CREATE POLICY "Admins can update orders"
    ON orders FOR UPDATE
    USING ((auth.jwt() ->> 'email') = '2022lingyun@gmail.com')
    WITH CHECK ((auth.jwt() ->> 'email') = '2022lingyun@gmail.com');

-- 3) 管理者新增特殊節日送審資料（先審核，不直接公開）
CREATE TABLE IF NOT EXISTS special_event_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    date_rule VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    submitted_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE special_event_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage special event submissions" ON special_event_submissions;
CREATE POLICY "Admins can manage special event submissions"
    ON special_event_submissions FOR ALL
    USING ((auth.jwt() ->> 'email') = '2022lingyun@gmail.com')
    WITH CHECK ((auth.jwt() ->> 'email') = '2022lingyun@gmail.com');
