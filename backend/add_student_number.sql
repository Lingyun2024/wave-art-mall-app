-- ============================================
-- 新增學員編號欄位
-- ============================================

-- 在 orders 表新增 student_number 欄位
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS student_number VARCHAR(20);

-- 為欄位新增註解
COMMENT ON COLUMN orders.student_number IS '學員編號（例如：Wei_001、Shye_001）';

-- 根據代理人姓名自動填入學員編號
UPDATE orders
SET student_number = CASE agent_name
    WHEN '魏正隆' THEN 'Wei_001'
    WHEN '謝幸汝' THEN 'Shye_001'
    WHEN '葉俊良' THEN 'Yen_001'
    WHEN '王學文' THEN 'Wang_001'
    WHEN '黃雅吟' THEN 'Huang_001'
    WHEN '彭秋芳' THEN 'Pung_001'
    WHEN '石鎂欗' THEN 'Shir_001'
    WHEN '謝菁樺' THEN 'Shye_002'
    ELSE NULL
END
WHERE agent_name IN ('魏正隆', '謝幸汝', '葉俊良', '王學文', '黃雅吟', '彭秋芳', '石鎂欗', '謝菁樺');

-- 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_orders_student_number ON orders(student_number);

-- ============================================
-- 完成！
-- ============================================
