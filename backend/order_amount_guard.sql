-- ============================================================================
-- order_amount_guard.sql   【v2】
-- 目的：堵住「客戶端偽造訂單金額」路徑，並自動補齊 NOT NULL 欄位
-- 適用：Supabase（PostgreSQL 13+）
-- 執行位置：Supabase Dashboard → SQL Editor → 貼上全部 → Run
-- 初版：2026-09-12　修訂：2026-09-22（tools/test_money_guard.mjs 本地實測後修正）
--
-- ============================================================================
-- ⚠️ v1 的致命缺陷（本地 PGlite 實測發現，v1 從未上線，故無災情）
--
--   v1 的 finalize_order_amount() 掛在 orders 上，是
--   DEFERRABLE INITIALLY DEFERRED 的 CONSTRAINT TRIGGER（事務提交前才結算）。
--
--   但 PostgREST 每次請求是各自提交的隱含交易，而 checkout.html 的流程是：
--     步驟 a  :416  insert orders        ← 第一次提交，此時 order_items 還是空的
--     步驟 b  :451  insert order_items   ← 第二次提交
--   → 第一次提交時結算觸發器就跑了，看見 0 個 order_items
--   → 拋出「商城訂單 … 沒有任何訂單項目，拒絕成立」
--   → 真實結帳 100% 失敗。
--
--   v1 的單元情境（同一交易內插完 orders + items）會通過，所以紙上看不出問題；
--   只有模擬真實時序（T4）才測得到。這正是本地 e2e 的價值。
--
--   v2 改法：不依賴交易邊界。
--     · orders 新增時，商城單金額一律歸零（前端傳多少都不算數）
--     · orders 更新時，商城單金額一律由 order_items 重算（堵住事後改價）
--     · order_items 異動後觸發一次父單重算，無論明細是同一交易還是後補都成立
-- ============================================================================
--
-- 【背景】
--   checkout.html:399-401 在前端計算 totalAmount，:421 直接 insert 進 orders。
--   orders 的 INSERT RLS 只檢查 auth.uid() = user_id，不檢查金額；
--   orders.total_amount 亦無 CHECK 約束。
--   → 任何已登入用戶可用 Console 直插 1 元訂單，繞過結帳頁。
--   （匿名插入已被 RLS 擋下，實測回 42501；風險僅在「已登入用戶」。）
--
-- 【v2 做四件事】
--   1. order_items.unit_price 一律以 products.price 覆蓋 → 前端傳的價格不算數
--   2. order_items.subtotal 由 DB 計算；quantity 必須 > 0 → 防負數灌水
--   3. orders 進來時：商城單（identity_type IS NULL）金額歸零、七七地赦單維持人工金額
--   4. order_items 異動後立刻重算父訂單 subtotal / total_amount
--
-- 【重要前提】
--   以「identity_type IS NULL」判定為商城訂單。
--   七七地赦訂單（holiday-form.html:473）只寫 orders、不寫 order_items，
--   且其 identity_type 非空，因此金額維持人工認定、不會被歸零。
--   ⚠ 若未來商城訂單也開始寫 identity_type，需同步調整本檔的判定條件。
--
-- 【已知取捨】
--   v1「商城單必須有明細否則拒絕」的硬擋在 v2 移除（那是結帳失敗的元凶）。
--   換來的風險：攻擊者可建立一張「0 元、0 明細」的空單。
--   但空單取不到商品（商品必定伴隨 order_items，一插明細就重算成正確價格），
--   故損失僅為髒資料。管理端請用本檔末尾的查詢定期撈空單清理。
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 【0】清除 v1 殘留（若曾執行過 v1，本段會把舊觸發器拆掉；沒執行過也安全）
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_finalize_order_amount ON orders;
DROP TRIGGER IF EXISTS trg_guard_order ON orders;
DROP TRIGGER IF EXISTS trg_guard_order_item ON order_items;


-- ---------------------------------------------------------------------------
-- 【1】order_items：價格以商品表為準、數量必須為正、小計由 DB 算
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_order_item()
RETURNS TRIGGER AS $$
DECLARE
  v_price DECIMAL(12,2);
  v_qty   INTEGER;
BEGIN
  v_qty := COALESCE(NEW.quantity, 0);
  IF v_qty <= 0 THEN
    RAISE EXCEPTION 'order_items.quantity 必須大於 0（收到 %）', v_qty
      USING ERRCODE = '23514';
  END IF;
  NEW.quantity := v_qty;

  SELECT price INTO v_price FROM products WHERE id = NEW.product_id;
  IF v_price IS NULL THEN
    RAISE EXCEPTION '找不到商品 %（無法取得價格）', NEW.product_id
      USING ERRCODE = '23503';
  END IF;

  NEW.unit_price := v_price;
  NEW.subtotal   := v_price * v_qty;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_order_item
  BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION guard_order_item();


-- ---------------------------------------------------------------------------
-- 【2】orders：商城單金額一律由 DB 說了算，前端/事後改價都不算數
--     INSERT → 先歸零（明細還沒寫，等【3】結算）
--     UPDATE → 直接用 order_items 重算（堵住「下單後再 UPDATE 成 1 元」）
--     七七地赦單（identity_type 非空）則全程維持人工金額
--     ⚠ 本觸發器不能再無條件歸零 UPDATE，否則會把【3】算好的金額又洗掉
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_order()
RETURNS TRIGGER AS $$
DECLARE
  v_cnt INTEGER;
  v_sum DECIMAL(12,2);
BEGIN
  -- 七七地赦訂單（identity_type 非空）：維持人工認定金額，只擋負值、補空欄
  IF NEW.identity_type IS NOT NULL THEN
    IF NEW.total_amount IS NOT NULL AND NEW.total_amount < 0 THEN
      RAISE EXCEPTION '訂單金額不得為負（收到 %）', NEW.total_amount
        USING ERRCODE = '23514';
    END IF;
    IF NEW.subtotal IS NULL THEN
      NEW.subtotal := COALESCE(NEW.total_amount, 0);
    END IF;
    IF NEW.total_amount IS NULL THEN
      NEW.total_amount := COALESCE(NEW.subtotal, 0);
    END IF;
    RETURN NEW;
  END IF;

  -- 商城訂單（identity_type IS NULL）
  IF TG_OP = 'INSERT' THEN
    -- 明細還沒寫進來，先歸零；前端傳的 total_amount 一律作廢
    NEW.subtotal     := 0;
    NEW.total_amount := 0;
    RETURN NEW;
  END IF;

  -- UPDATE：以 order_items 為唯一真相重算，任何手改金額都會被蓋掉
  SELECT COUNT(*), COALESCE(SUM(subtotal), 0)
    INTO v_cnt, v_sum
    FROM order_items
   WHERE order_id = NEW.id;

  IF v_cnt = 0 THEN
    NEW.subtotal     := 0;
    NEW.total_amount := 0;
  ELSE
    NEW.subtotal     := v_sum;
    NEW.total_amount := v_sum
                      + COALESCE(NEW.shipping_fee, 0)
                      + COALESCE(NEW.tax, 0)
                      - COALESCE(NEW.discount, 0);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_order
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION guard_order();


-- ---------------------------------------------------------------------------
-- 【3】order_items 異動後重算父訂單金額（v2：取代 v1 的 deferred 約束觸發器）
--     掛在 order_items 上，不依賴交易邊界 → 真實 checkout 的兩段式寫入也能成立
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION finalize_order_amount()
RETURNS TRIGGER AS $$
DECLARE
  v_sum      DECIMAL(12,2);
  v_order_id UUID;
  v_orders   RECORD;
BEGIN
  -- AFTER DELETE 時 NEW 為 NULL，必須按 TG_OP 取 order_id
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  SELECT identity_type, shipping_fee, tax, discount
    INTO v_orders
    FROM orders
   WHERE id = v_order_id;

  -- 父單不存在（理論上不會發生，外鍵已保證）或非商城單 → 不重算
  IF NOT FOUND OR v_orders.identity_type IS NOT NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(subtotal), 0)
    INTO v_sum
    FROM order_items
   WHERE order_id = v_order_id;

  UPDATE orders
     SET subtotal     = v_sum,
         total_amount = v_sum
                      + COALESCE(v_orders.shipping_fee, 0)
                      + COALESCE(v_orders.tax, 0)
                      - COALESCE(v_orders.discount, 0)
   WHERE id = v_order_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_finalize_order_amount ON order_items;
CREATE TRIGGER trg_finalize_order_amount
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION finalize_order_amount();


-- ---------------------------------------------------------------------------
-- 【4】orders.total_amount 非負約束（NOT VALID：不檢查既有資料，只約束新寫入）
--     確認既有資料無負值後，可執行最後一行的 VALIDATE 讓它對舊資料也生效
-- ---------------------------------------------------------------------------
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_total_nonneg;
ALTER TABLE orders ADD CONSTRAINT chk_orders_total_nonneg
  CHECK (total_amount >= 0) NOT VALID;

-- 既有資料確認乾淨後再執行：
-- ALTER TABLE orders VALIDATE CONSTRAINT chk_orders_total_nonneg;


-- ============================================================================
-- 【驗證方式】
--
-- A) 自動化（推薦）：本機跑 `npm run test:money`
--    PGlite 離線實測六個情境，含「真實 checkout 兩段式寫入」時序（v1 就是死在這條）。
--
-- B) 上線後人工驗一次（走 category → product-detail → cart → checkout）：
--      SELECT o.order_number, o.total_amount,
--             (SELECT SUM(subtotal) FROM order_items WHERE order_id = o.id) AS items_sum
--        FROM orders o
--       ORDER BY o.created_at DESC LIMIT 5;
--    → total_amount 應等於 items_sum，且不為 0。
--
-- C) 偽造測試（Console 用已登入帳號執行）：
--      await supabaseClient.from('orders').insert({
--        user_id: (await supabaseClient.auth.getUser()).data.user.id,
--        status: '待處理', total_amount: 1, identity_type: null,
--        recipient_name: 'x', phone: '0900000000',
--        street_address: 'x', city: 'x', district: 'x',
--        payment_method: 'bank_transfer'
--      });
--    → 預期成功建立，但 total_amount 被歸零（0），拿不到任何商品。
--
-- D) 定期清理空單（v2 已知取捨的配套）：
--      SELECT o.id, o.order_number, o.created_at, o.total_amount
--        FROM orders o
--       WHERE o.identity_type IS NULL
--         AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
--       ORDER BY o.created_at DESC;
--
-- 【回滾方式】（如需還原）
--   DROP TRIGGER IF EXISTS trg_finalize_order_amount ON order_items;
--   DROP TRIGGER IF EXISTS trg_guard_order ON orders;
--   DROP TRIGGER IF EXISTS trg_guard_order_item ON order_items;
--   ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_total_nonneg;
--   DROP FUNCTION IF EXISTS finalize_order_amount();
--   DROP FUNCTION IF EXISTS guard_order();
--   DROP FUNCTION IF EXISTS guard_order_item();
-- ============================================================================
