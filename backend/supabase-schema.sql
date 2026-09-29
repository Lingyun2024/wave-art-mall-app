-- ============================================
-- WAVE ART MALL - Supabase 資料庫架構
-- 高端藝術電商平台
-- ============================================

-- 啟用必要擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 商品分類表 (categories)
-- ============================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(50),
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE categories IS '商品分類';

-- ============================================
-- 2. 藝術家/創作者表 (artists)
-- ============================================
CREATE TABLE artists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    handle VARCHAR(100) NOT NULL UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    website_url TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. 商品表 (products)
-- ============================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    artist_id UUID REFERENCES artists(id) ON DELETE SET NULL,

    -- 價格
    price DECIMAL(12,2) NOT NULL,
    original_price DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'TWD',

    -- 庫存
    stock_quantity INTEGER DEFAULT 0,
    sold_count INTEGER DEFAULT 0,

    -- 媒體
    main_image_url TEXT NOT NULL,
    image_urls TEXT[],

    -- 商品屬性
    series_name VARCHAR(255),
    edition_info VARCHAR(100),
    is_auction BOOLEAN DEFAULT FALSE,
    current_bid DECIMAL(12,2),
    bid_count INTEGER DEFAULT 0,

    -- 狀態
    status VARCHAR(20) DEFAULT 'active', -- active, sold_out, draft, discontinued
    is_featured BOOLEAN DEFAULT FALSE,
    is_flash_sale BOOLEAN DEFAULT FALSE,
    flash_sale_discount INTEGER, -- 折扣百分比

    -- 標籤與搜尋
    tags TEXT[],
    meta_title VARCHAR(255),
    meta_description TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_featured ON products(is_featured);
CREATE INDEX idx_products_flash_sale ON products(is_flash_sale);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_created ON products(created_at DESC);

-- Full-text search (使用 PostgreSQL tsvector)
ALTER TABLE products ADD COLUMN search_vector tsvector;
CREATE INDEX idx_products_search ON products USING GIN(search_vector);

-- 更新搜尋向量的函數
CREATE OR REPLACE FUNCTION update_product_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_search_update
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_product_search_vector();

-- ============================================
-- 4. 限時搶購表 (flash_sales)
-- ============================================
CREATE TABLE flash_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 90),
    sale_price DECIMAL(12,2) NOT NULL,
    stock_limit INTEGER NOT NULL,
    sold_count INTEGER DEFAULT 0,
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_flash_sales_active ON flash_sales(is_active, end_at);
CREATE INDEX idx_flash_sales_time ON flash_sales(start_at, end_at);

-- ============================================
-- 5. 用戶資料表 (profiles)
-- 與 Supabase Auth 的 users 表關聯
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50),
    full_name VARCHAR(100),
    avatar_url TEXT,
    phone VARCHAR(20),
    bio TEXT,
    is_artist BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 新用戶註冊時自動建立 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 6. 收貨地址表 (shipping_addresses)
-- ============================================
CREATE TABLE shipping_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    city VARCHAR(50) NOT NULL,
    district VARCHAR(50) NOT NULL,
    street_address TEXT NOT NULL,
    postal_code VARCHAR(10),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_shipping_addresses_user ON shipping_addresses(user_id);

-- ============================================
-- 7. 購物車表 (cart_items)
-- ============================================
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_user_product_cart UNIQUE (user_id, product_id)
);

CREATE INDEX idx_cart_items_user ON cart_items(user_id);

-- ============================================
-- 8. 收藏表 (favorites)
-- ============================================
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_user_product_fav UNIQUE (user_id, product_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_product ON favorites(product_id);

-- ============================================
-- 9. 訂單表 (orders)
-- ============================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 金額
    subtotal DECIMAL(12,2) NOT NULL,
    shipping_fee DECIMAL(12,2) DEFAULT 0,
    tax DECIMAL(12,2) DEFAULT 0,
    discount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TWD',

    -- 配送資訊
    recipient_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    city VARCHAR(50) NOT NULL,
    district VARCHAR(50) NOT NULL,
    street_address TEXT NOT NULL,
    postal_code VARCHAR(10),
    delivery_method VARCHAR(20) DEFAULT 'home', -- home, store

    -- 付款
    payment_method VARCHAR(20) NOT NULL, -- credit_card, bank_transfer, line_pay
    payment_status VARCHAR(20) DEFAULT 'pending', -- pending, paid, failed, refunded
    paid_at TIMESTAMP WITH TIME ZONE,

    -- 訂單狀態
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, processing, shipped, delivered, cancelled, returned
    tracking_number VARCHAR(100),
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,

    -- 備註
    customer_note TEXT,
    admin_note TEXT,

    -- 七七地赦（MD_SP）專屬欄位
    identity_type VARCHAR(30),          -- 身分：personal/family/business/society/savior/heritage
    age INTEGER,                        -- 虛歲
    agent_name VARCHAR(100),            -- 代理人
    transfer_note VARCHAR(20),          -- 匯款後五碼

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- 訂單編號產生函數
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number := 'WA' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION generate_order_number();

-- ============================================
-- 10. 訂單項目表 (order_items)
-- ============================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    product_image_url TEXT,
    unit_price DECIMAL(12,2) NOT NULL,
    quantity INTEGER NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================
-- 11. 訂單狀態歷程表 (order_status_history)
-- ============================================
CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_order_status_history ON order_status_history(order_id);

-- ============================================
-- Row Level Security (RLS) 權限設定
-- ============================================

-- 啟用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- profiles: 用戶只能看到自己的資料，公開資料所有人可讀
CREATE POLICY "Profiles are viewable by everyone"
    ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id);

-- shipping_addresses: 用戶只能管理自己的地址
CREATE POLICY "Users can manage own addresses"
    ON shipping_addresses FOR ALL USING (auth.uid() = user_id);

-- cart_items: 用戶只能管理自己的購物車
CREATE POLICY "Users can manage own cart"
    ON cart_items FOR ALL USING (auth.uid() = user_id);

-- favorites: 用戶只能管理自己的收藏
CREATE POLICY "Users can manage own favorites"
    ON favorites FOR ALL USING (auth.uid() = user_id);

-- orders: 用戶只能看到自己的訂單
CREATE POLICY "Users can view own orders"
    ON orders FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
    ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending orders"
    ON orders FOR UPDATE
    USING (auth.uid() = user_id AND payment_status = 'pending')
    WITH CHECK (auth.uid() = user_id AND payment_status = 'pending');

-- 管理員（背景名冊頁 admin-roster.html）可跨用戶檢視 / 更新訂單
-- 注意：本策略也需同步到線上 Supabase（見 holiday_admin_patch.sql）
CREATE POLICY "Admins can view all orders"
    ON orders FOR SELECT
    USING ((auth.jwt() ->> 'email') = '2022lingyun@gmail.com');

CREATE POLICY "Admins can update orders"
    ON orders FOR UPDATE
    USING ((auth.jwt() ->> 'email') = '2022lingyun@gmail.com')
    WITH CHECK ((auth.jwt() ->> 'email') = '2022lingyun@gmail.com');

-- order_items: 用戶只能看到屬於自己訂單的項目
CREATE POLICY "Users can view own order items"
    ON order_items FOR SELECT USING (
        EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
    );

CREATE POLICY "Users can create order items for own orders"
    ON order_items FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
    );

-- order_status_history: 用戶只能查看自己訂單的歷程
CREATE POLICY "Users can view own order history"
    ON order_status_history FOR SELECT USING (
        EXISTS (SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND orders.user_id = auth.uid())
    );

-- 公開資料表（所有人可讀）
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are viewable by everyone"
    ON categories FOR SELECT USING (true);

CREATE POLICY "Artists are viewable by everyone"
    ON artists FOR SELECT USING (true);

CREATE POLICY "Products are viewable by everyone"
    ON products FOR SELECT USING (status = 'active');

CREATE POLICY "Flash sales are viewable by everyone"
    ON flash_sales FOR SELECT USING (true);

-- ============================================
-- 自動更新 updated_at 觸發器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipping_addresses_updated_at BEFORE UPDATE ON shipping_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 插入初始測試資料
-- ============================================

-- 分類資料
INSERT INTO categories (name, slug, icon, description, sort_order) VALUES
('特殊節日', 'special-events', 'celebration', '節慶限定藝術品', 1),
('食', 'food', 'restaurant', '美食藝術與餐飲文化', 2),
('衣', 'fashion', 'apparel', '時尚與服裝設計', 3),
('住', 'home', 'home', '家居與空間藝術', 4),
('行', 'travel', 'directions_car', '旅行與移動藝術', 5),
('育', 'education', 'school', '教育與知識藝術', 6),
('樂', 'entertainment', 'videogame_asset', '娛樂與遊戲藝術', 7),
('藝術', 'art', 'palette', '純藝術與數位創作', 8),
('運動', 'sports', 'fitness_center', '運動與健身藝術', 9),
('美妝', 'beauty', 'face', '美容與化妝藝術', 10),
('3C', 'tech', 'devices', '科技與數位產品', 11);

-- 藝術家資料
INSERT INTO artists (name, handle, avatar_url, bio, verified) VALUES
('NeuroLinker', '@NeuroLinker', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop', '數位神經連結藝術先驅', true),
('Archi_Mind', '@Archi_Mind', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', '建築思維數位雕塑家', true),
('EtherFlow', '@EtherFlow', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', '以太流動視覺藝術家', true),
('ZeroG_Art', '@ZeroG_Art', 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&h=100&fit=crop', '零重力抽象藝術創作者', true),
('林偉', '@linwei_art', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop', '傳統與現代融合大師', true);

-- 商品資料
INSERT INTO products (
    name, slug, description, category_id, artist_id,
    price, original_price, stock_quantity,
    main_image_url, image_urls,
    series_name, edition_info, is_auction, current_bid, bid_count,
    status, is_featured, is_flash_sale, flash_sale_discount,
    tags
) VALUES
(
    '星系連結 (Celestial Nexus)', 'celestial-nexus',
    '由頂尖數位創作者打造的虛擬實境作品，呈現星系間的神秘連結。',
    (SELECT id FROM categories WHERE slug = 'art'),
    (SELECT id FROM artists WHERE handle = '@NeuroLinker'),
    12500.00, NULL, 1,
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&h=600&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&h=600&fit=crop'],
    '數位永恆', '1/10', true, 12500.00, 3,
    'active', true, false, NULL,
    ARRAY['數位藝術', 'NFT', '星系', '霓虹']
),
(
    '虛無亭 (Void Pavilion)', 'void-pavilion',
    '建築與虛擬空間的完美融合，展現未來建築的無限可能。',
    (SELECT id FROM categories WHERE slug = 'art'),
    (SELECT id FROM artists WHERE handle = '@Archi_Mind'),
    8000.00, NULL, 3,
    'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=600&h=600&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=600&h=600&fit=crop'],
    '元空間紀錄', '限量', false, NULL, 0,
    'active', true, false, NULL,
    ARRAY['建築', '虛擬實境', '數位雕塑']
),
(
    '量子繆斯 (Quantum Muse)', 'quantum-muse',
    '量子力學與藝術的碰撞，捕捉微觀世界的詩意。',
    (SELECT id FROM categories WHERE slug = 'art'),
    (SELECT id FROM artists WHERE handle = '@EtherFlow'),
    45200.00, NULL, 1,
    'https://images.unsplash.com/photo-1633186710895-309db2eca9e4?w=600&h=600&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1633186710895-309db2eca9e4?w=600&h=600&fit=crop'],
    '量子詩篇', '1/1', true, 45200.00, 7,
    'active', true, false, NULL,
    ARRAY['量子', '肖像', '數位藝術', '獨一無二']
),
(
    '時光流 (Chronos Flow)', 'chronos-flow',
    '時間的視覺化呈現，金屬液態的流動象徵時間的不可逆。',
    (SELECT id FROM categories WHERE slug = 'art'),
    (SELECT id FROM artists WHERE handle = '@ZeroG_Art'),
    5300.00, 8000.00, 5,
    'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&h=600&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&h=600&fit=crop'],
    '時間系列', '限量版', false, NULL, 0,
    'active', false, true, 30,
    ARRAY['抽象', '時間', '金屬質感']
),
(
    'Waterfall Eternity', 'waterfall-eternity',
    '瀑布永恆 - 自然與永恆的完美結合。',
    (SELECT id FROM categories WHERE slug = 'art'),
    (SELECT id FROM artists WHERE handle = '@linwei_art'),
    5600.00, NULL, 10,
    'https://images.unsplash.com/photo-1515405295579-ba7b45403062?w=600&h=600&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1515405295579-ba7b45403062?w=600&h=600&fit=crop'],
    '自然詩篇', NULL, false, NULL, 0,
    'active', false, false, NULL,
    ARRAY['自然', '瀑布', '風景']
),
(
    'Galactic Spirit #04', 'galactic-spirit-04',
    '銀河靈魂系列第四號作品，探索宇宙意識。',
    (SELECT id FROM categories WHERE slug = 'art'),
    (SELECT id FROM artists WHERE handle = '@NeuroLinker'),
    12000.00, NULL, 2,
    'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=600&h=600&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=600&h=600&fit=crop'],
    '銀河靈魂', '4/20', false, NULL, 0,
    'active', false, false, NULL,
    ARRAY['銀河', '宇宙', '靈魂']
),
(
    'Imperial View', 'imperial-view',
    '帝國視野 - 宏偉壯觀的數位山水畫。',
    (SELECT id FROM categories WHERE slug = 'art'),
    (SELECT id FROM artists WHERE handle = '@linwei_art'),
    8900.00, NULL, 8,
    'https://images.unsplash.com/photo-1518173946687-a4c036bc7bf8?w=600&h=600&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1518173946687-a4c036bc7bf8?w=600&h=600&fit=crop'],
    '山水數位', NULL, false, NULL, 0,
    'active', false, false, NULL,
    ARRAY['山水', '傳統', '數位']
),
(
    'Cyber Origin', 'cyber-origin',
    '賽博起源 - 未來主義數位藝術的開端。',
    (SELECT id FROM categories WHERE slug = 'tech'),
    (SELECT id FROM artists WHERE handle = '@ZeroG_Art'),
    15500.00, 22000.00, 3,
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=600&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=600&fit=crop'],
    '賽博系列', '限量', false, NULL, 0,
    'active', false, true, 45,
    ARRAY['賽博', '未來', '科技']
),
(
    'Meta-Origin #001', 'meta-origin-001',
    '元起源頭號作品，開啟元宇宙藝術新紀元。',
    (SELECT id FROM categories WHERE slug = 'art'),
    (SELECT id FROM artists WHERE handle = '@NeuroLinker'),
    50000.00, NULL, 1,
    'https://images.unsplash.com/photo-1634017839464-5c339bbe3c35?w=600&h=600&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1634017839464-5c339bbe3c35?w=600&h=600&fit=crop'],
    '元起源', '1/1', true, 50000.00, 12,
    'active', true, false, NULL,
    ARRAY['元宇宙', '起源', '獨一無二']
),
(
    'Imperial Serenity', 'imperial-serenity',
    '傳統山水畫的數位重構，東方美學的當代詮釋。',
    (SELECT id FROM categories WHERE slug = 'art'),
    (SELECT id FROM artists WHERE handle = '@linwei_art'),
    25000.00, NULL, 5,
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&h=600&fit=crop',
    ARRAY['https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&h=600&fit=crop'],
    '傳統迴響', '限量版', false, NULL, 0,
    'active', true, false, NULL,
    ARRAY['傳統', '山水', '東方美學']
);

-- 限時搶購資料
INSERT INTO flash_sales (product_id, discount_percent, sale_price, stock_limit, sold_count, start_at, end_at, is_active)
VALUES
(
    (SELECT id FROM products WHERE slug = 'chronos-flow'),
    30, 5300.00, 20, 15,
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '23 hours',
    true
),
(
    (SELECT id FROM products WHERE slug = 'cyber-origin'),
    45, 15500.00, 10, 9,
    NOW() - INTERVAL '2 hours',
    NOW() + INTERVAL '22 hours',
    true
);

-- ============================================
-- 建立資料庫函數
-- ============================================

-- 取得用戶購物車摘要（含商品資訊）
CREATE OR REPLACE FUNCTION get_cart_summary(p_user_id UUID)
RETURNS TABLE (
    item_count BIGINT,
    total_amount DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT,
        COALESCE(SUM(p.price * c.quantity), 0)::DECIMAL
    FROM cart_items c
    JOIN products p ON p.id = c.product_id
    WHERE c.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 建立訂單（包含訂單項目與清空購物車）
CREATE OR REPLACE FUNCTION create_order_from_cart(
    p_user_id UUID,
    p_recipient_name VARCHAR,
    p_phone VARCHAR,
    p_email VARCHAR,
    p_city VARCHAR,
    p_district VARCHAR,
    p_street_address TEXT,
    p_postal_code VARCHAR,
    p_delivery_method VARCHAR,
    p_payment_method VARCHAR,
    p_shipping_fee DECIMAL DEFAULT 1200,
    p_tax_rate DECIMAL DEFAULT 0.05
)
RETURNS UUID AS $$
DECLARE
    v_order_id UUID;
    v_subtotal DECIMAL;
    v_tax DECIMAL;
    v_total DECIMAL;
BEGIN
    -- 計算小計
    SELECT COALESCE(SUM(p.price * c.quantity), 0)
    INTO v_subtotal
    FROM cart_items c
    JOIN products p ON p.id = c.product_id
    WHERE c.user_id = p_user_id;

    IF v_subtotal = 0 THEN
        RAISE EXCEPTION '購物車是空的';
    END IF;

    v_tax := ROUND(v_subtotal * p_tax_rate);
    v_total := v_subtotal + p_shipping_fee + v_tax;

    -- 建立訂單
    INSERT INTO orders (
        user_id, subtotal, shipping_fee, tax, total_amount,
        recipient_name, phone, email, city, district, street_address, postal_code,
        delivery_method, payment_method
    ) VALUES (
        p_user_id, v_subtotal, p_shipping_fee, v_tax, v_total,
        p_recipient_name, p_phone, p_email, p_city, p_district, p_street_address, p_postal_code,
        p_delivery_method, p_payment_method
    )
    RETURNING id INTO v_order_id;

    -- 建立訂單項目
    INSERT INTO order_items (order_id, product_id, product_name, product_image_url, unit_price, quantity, subtotal)
    SELECT
        v_order_id,
        p.id,
        p.name,
        p.main_image_url,
        p.price,
        c.quantity,
        p.price * c.quantity
    FROM cart_items c
    JOIN products p ON p.id = c.product_id
    WHERE c.user_id = p_user_id;

    -- 清空購物車
    DELETE FROM cart_items WHERE user_id = p_user_id;

    -- 記錄訂單狀態歷程
    INSERT INTO order_status_history (order_id, status, note)
    VALUES (v_order_id, 'pending', '訂單已建立，等待付款');

    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 完成！
-- ============================================
