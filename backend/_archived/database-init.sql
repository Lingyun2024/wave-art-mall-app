-- ============================================
-- 寵物領養平台 - 資料庫初始化腳本
-- 適用於 Supabase (PostgreSQL)
-- ============================================

-- 1. 使用者資料表 (users)
-- 儲存註冊用戶的基本資訊
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- 唯一識別碼
    username VARCHAR(50) NOT NULL,                   -- 使用者名稱
    email VARCHAR(255) NOT NULL UNIQUE,              -- 電子郵件（用於登入）
    password_hash VARCHAR(255) NOT NULL,             -- 加密後的密碼
    avatar_url TEXT,                                 -- 頭像圖片網址
    phone VARCHAR(20),                               -- 聯絡電話
    address TEXT,                                    -- 住址
    is_verified BOOLEAN DEFAULT FALSE,               -- 是否已驗證邮箱
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 建立時間
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  -- 更新時間
);

-- 建立索引加速查詢
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);


-- 2. 寵物資訊表 (pets)
-- 儲存可領養寵物的詳細資訊
CREATE TABLE pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- 唯一識別碼
    name VARCHAR(100) NOT NULL,                      -- 寵物名字
    type VARCHAR(20) NOT NULL,                       -- 種類：cat(貓) / dog(狗)
    breed VARCHAR(100),                              -- 品種
    age INTEGER,                                     -- 年齡（歲）
    weight DECIMAL(5,2),                             -- 體重（公斤）
    gender VARCHAR(10),                              -- 性別：male(公) / female(母)
    color VARCHAR(50),                               -- 毛色
    health_info TEXT,                                -- 健康狀況說明
    description TEXT,                                -- 詳細描述
    personality_tags TEXT[],                         -- 性格標籤陣列（如：溫順、活潑）
    image_urls TEXT[],                               -- 照片網址陣列
    main_image_url TEXT,                             -- 主圖網址
    shelter_id UUID,                                 -- 所屬收容單位 ID
    status VARCHAR(20) DEFAULT 'available',          -- 狀態：available(可領養) / adopted(已領養) / pending(審核中)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 建立時間
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  -- 更新時間
);

-- 建立索引
CREATE INDEX idx_pets_type ON pets(type);
CREATE INDEX idx_pets_status ON pets(status);
CREATE INDEX idx_pets_name ON pets(name);


-- 3. 收容單位表 (shelters)
-- 儲存收容所/動物園的資訊
CREATE TABLE shelters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- 唯一識別碼
    name VARCHAR(200) NOT NULL,                      -- 收容所名稱
    location VARCHAR(255),                           -- 地址
    contact_phone VARCHAR(20),                       -- 聯絡電話
    contact_email VARCHAR(255),                      -- 聯絡信箱
    description TEXT,                                -- 簡介
    logo_url TEXT,                                   -- Logo 圖片
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 建立時間
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  -- 更新時間
);


-- 4. 領養申請表 (adoption_applications)
-- 記錄用戶提交的領養申請
CREATE TABLE adoption_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- 唯一識別碼
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 申請者 ID
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,   -- 申請領養的寵物 ID
    applicant_name VARCHAR(100) NOT NULL,            -- 申請人姓名
    applicant_phone VARCHAR(20) NOT NULL,            -- 申請人電話
    applicant_email VARCHAR(255) NOT NULL,           -- 申請人信箱
    applicant_address TEXT,                          -- 申請人地址
    living_situation TEXT,                           -- 居住環境說明
    reason TEXT,                                     -- 領養原因
    status VARCHAR(20) DEFAULT 'pending',            -- 狀態：pending(待審核) / approved(已通过) / rejected(被拒絕)
    admin_note TEXT,                                 -- 管理員備註
    reviewed_by UUID,                                -- 審核管理員 ID
    reviewed_at TIMESTAMP WITH TIME ZONE,            -- 審核時間
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 建立時間
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  -- 更新時間
);

-- 建立索引
CREATE INDEX idx_applications_user_id ON adoption_applications(user_id);
CREATE INDEX idx_applications_pet_id ON adoption_applications(pet_id);
CREATE INDEX idx_applications_status ON adoption_applications(status);


-- 5. 收藏記錄表 (favorites)
-- 記錄用戶收藏的寵物
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- 唯一識別碼
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 用戶 ID
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,   -- 寵物 ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 建立時間
    
    -- 確保同一用戶不會重複收藏同一隻寵物
    CONSTRAINT unique_user_pet UNIQUE (user_id, pet_id)
);

-- 建立索引
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_pet_id ON favorites(pet_id);


-- 6. 消息通知表 (messages)
-- 系統發送給用戶的通知訊息
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- 唯一識別碼
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 接收者 ID
    title VARCHAR(255) NOT NULL,                     -- 訊息標題
    content TEXT NOT NULL,                           -- 訊息內容
    type VARCHAR(50) DEFAULT 'info',                 -- 類型：info(一般) / application(申請相關) / system(系統)
    is_read BOOLEAN DEFAULT FALSE,                   -- 是否已讀
    read_at TIMESTAMP WITH TIME ZONE,                -- 已讀時間
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- 建立時間
);

-- 建立索引
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_is_read ON messages(is_read);


-- ============================================
-- 觸發器：自動更新 updated_at 欄位
-- ============================================

-- 建立函數
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 為各表加入觸發器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pets_updated_at BEFORE UPDATE ON pets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shelters_updated_at BEFORE UPDATE ON shelters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON adoption_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- 插入測試資料
-- ============================================

-- 插入測試用戶（密碼是 "password123" 的 hash，實際使用時請用真實 hash）
INSERT INTO users (username, email, password_hash, phone, address) VALUES
('小明', 'xiaoming@example.com', '$2a$10$example_hash_placeholder', '0912-345-678', '台北市大安區'),
('小華', 'xiaohua@example.com', '$2a$10$example_hash_placeholder', '0923-456-789', '新北市板橋區');

-- 插入收容所資料
INSERT INTO shelters (name, location, contact_phone, contact_email, description) VALUES
('台北市動物保護處', '台北市內湖區金龍路 88 號', '02-2791-0123', 'contact@tspca.gov.tw', '台北市政府設立的大型動物收容所'),
('台灣流浪動物關懷協會', '台中市西屯區', '04-2345-6789', 'info@twanimal.org', '民間非營利動物保護組織');

-- 插入寵物資料
INSERT INTO pets (name, type, breed, age, weight, gender, color, health_info, description, personality_tags, main_image_url, shelter_id, status) VALUES
('小橘', 'cat', '英國短毛貓', 2, 4.5, 'male', '橘色', '健康良好，已絕育，已完成疫苗接種', '一隻超級溫柔的貓咪，喜歡被人抱抱，適合有小孩的家庭', ARRAY['溫順', '愛撒嬌', '安靜'], 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&h=600&fit=crop', (SELECT id FROM shelters LIMIT 1), 'available'),

('豆豆', 'dog', '黃金獵犬', 3, 28.0, 'female', '金色', '健康良好，已絕育，已完成疫苗接種', '非常友善且聰明的大狗狗，會看家也會陪玩，需要較大的活動空間', ARRAY['活潑', '聰明', '忠誠'], 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&h=600&fit=crop', (SELECT id FROM shelters LIMIT 1), 'available'),

('小黑', 'cat', '黑貓', 1, 3.8, 'male', '黑色', '健康良好，已絕育', '有點害羞但很黏人，需要耐心照顧', ARRAY['害羞', '黏人', '室內貓'], 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=600&h=600&fit=crop', (SELECT id FROM shelters LIMIT 1), 'pending'),

('小白', 'dog', '比熊犬', 0.5, 2.5, 'female', '白色', '健康良好，正在施打幼犬疫苗', '超可愛的幼犬，超級黏人，需要主人多花時間陪伴', ARRAY['可愛', '黏人', '幼犬'], 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600&h=600&fit=crop', (SELECT id FROM shelters LIMIT 1), 'available');

-- 插入測試領養申請
INSERT INTO adoption_applications (user_id, pet_id, applicant_name, applicant_phone, applicant_email, applicant_address, living_situation, reason, status) VALUES
((SELECT id FROM users WHERE username='小明'), (SELECT id FROM pets WHERE name='小橘'), '小明', '0912-345-678', 'xiaoming@example.com', '台北市大安區', '自有住宅，有陽台', '一直想養一隻貓咪，小橘看起來很溫柔', 'pending'),

((SELECT id FROM users WHERE username='小華'), (SELECT id FROM pets WHERE name='豆豆'), '小華', '0923-456-789', 'xiaohua@example.com', '新北市板橋區', '租屋處，有院子', '喜歡大狗狗，希望能給豆豆一個溫暖的家', 'approved');

-- 插入測試消息
INSERT INTO messages (user_id, title, content, type) VALUES
((SELECT id FROM users WHERE username='小明'), '領養申請已收到', '您的領養申請（小橘）已成功提交，我們會盡快審核並通知您結果。', 'application'),
((SELECT id FROM users WHERE username='小華'), '恭喜！領養申請通過', '您的領養申請（豆豆）已通過審核，請於三天內到收容所辦理領養手續。', 'application');

-- 插入測試收藏
INSERT INTO favorites (user_id, pet_id) VALUES
((SELECT id FROM users WHERE username='小明'), (SELECT id FROM pets WHERE name='豆豆')),
((SELECT id FROM users WHERE username='小華'), (SELECT id FROM pets WHERE name='小橘'));


-- ============================================
-- 完成！
-- ============================================
-- 執行完這個腳本後，您的資料庫就準備好了！
-- 接下來需要在應用程式中配置 Supabase 的連接資訊。
