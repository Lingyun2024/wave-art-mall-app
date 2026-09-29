-- ============================================================================
-- reviews_policy_patch.sql
-- 目的：為 reviews 表補上 RLS 政策，讓「訂單評價」功能可以正常送出，
--       同時防止沒買過的人亂刷評價。
-- 適用：Supabase（PostgreSQL）
-- 執行位置：Supabase Dashboard → SQL Editor → 貼上全部 → Run
-- 建立日期：2026-09-12
--
-- 【背景】
--   order-history.html:494 有「前往評價此訂單商品」連到 review.html（原本 404），
--   已補上 pages/review.html。該頁會 insert 到 reviews 表。
--   reviews 表線上實際欄位（實測）：
--     id, product_id, user_id, order_id, rating, comment, created_at
--   ⚠ 本表未記錄在 backend/supabase-schema.sql，屬 schema 漂移，建議一併補文件。
--
-- 【⚠ 執行前請注意】
--   下方 DROP POLICY IF EXISTS 會覆蓋現有同名政策。
--   若您已為 reviews 設定過自訂政策，請先到
--     Dashboard → Authentication → Policies → reviews
--   確認內容再決定是否執行。
-- ============================================================================

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 讀取：所有人（含未登入訪客）都能看到評價，商品頁才顯示得出來
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read reviews" ON reviews;
CREATE POLICY "Anyone can read reviews"
  ON reviews FOR SELECT
  USING (true);

-- ---------------------------------------------------------------------------
-- 新增：必須是本人，且必須真的買過該商品（用 order_items 驗證）
--       這條同時擋掉「沒下單卻狂刷五星」的情境
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Buyers can create own reviews" ON reviews;
CREATE POLICY "Buyers can create own reviews"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = reviews.order_id
         AND o.user_id = auth.uid()
         AND oi.product_id = reviews.product_id
         AND o.status <> '已取消'
    )
  );

-- ---------------------------------------------------------------------------
-- 修改 / 刪除：只能動自己的評價
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;
CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 防止同一人對同一訂單的同一商品重複評價
--   （review.html 已在前端擋，這一條是後端保險）
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_per_order_product
  ON reviews(order_id, product_id, user_id);

-- ============================================================================
-- 【驗證方式】
-- 1) 未登入開 pages/product-detail.html?id=<任一商品> → 評價列表正常顯示（SELECT 政策）
-- 2) 登入後從 order-history.html 點「前往評價此訂單商品」→ 應進入 review.html
--    選星並送出 → 回「感謝您的評價！」
-- 3) 在 Console 嘗試對「沒買過的訂單」插入評價 → 應被擋（42501）
--
-- 【回滾方式】
--   DROP POLICY IF EXISTS "Anyone can read reviews" ON reviews;
--   DROP POLICY IF EXISTS "Buyers can create own reviews" ON reviews;
--   DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
--   DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;
--   DROP INDEX IF EXISTS uniq_review_per_order_product;
-- ============================================================================
