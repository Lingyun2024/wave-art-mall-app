# WAVE ART MALL - Supabase 後端整合指南

## 專案概述

這是一個高端藝術電商平台，前端使用純 HTML + Tailwind CSS CDN，後端採用 Supabase（PostgreSQL + Auth + Storage）。

---

## 檔案結構

```
G:\草稿\待辦事項\APP_!\
├── 首頁.md                          # 首頁（商品列表、限時搶購、推薦）
├── 產品介紹.md                       # 商品分類/列表頁
├── 購物車/
│   └── P1.md                        # 商品詳情頁
├── 收蔵清單.md                       # 購物車頁面
├── 結帳.md / 訂單摘要.md              # 結帳頁面
├── 基本資料.md                       # 登入/註冊頁面
├── 訂單確認.md / 訂單詳情.md          # 訂單相關
├── backend/                         # ← 後端檔案（你目前在這裡）
│   ├── supabase-schema.sql          # 資料庫架構（複製到 Supabase SQL Editor 執行）
│   ├── supabase-client.js           # Supabase 客戶端初始化 + 認證管理
│   ├── api-service.js               # 所有 API 封裝（商品、購物車、訂單、收藏）
│   ├── page-integrations.js         # 各頁面資料載入與互動邏輯
│   └── INTEGRATION_GUIDE.md         # 本文件
└── README.md
```

---

## Step 1：Supabase 專案設定

### 1.1 建立專案

1. 前往 [supabase.com](https://supabase.com) 登入
2. 點擊 "New Project"
3. 設定專案名稱：`wave-art-mall`
4. 選擇地區（建議選 `East Asia (Northeast) - Tokyo` 離台灣最近）
5. 等待專案建立完成（約 1-2 分鐘）

### 1.2 取得 API 金鑰

1. 在左側選單點擊 **Project Settings**
2. 點擊 **API**
3. 記下這兩個值：
   - **Project URL**（例如：`https://xxxxxx.supabase.co`）
   - **anon / public** key（以 `eyJhbG...` 開頭的長字串）

### 1.3 更新前端設定

打開 `backend/supabase-client.js`，把這兩行改成你的實際值：

```javascript
const SUPABASE_CONFIG = {
    URL: 'https://你的專案ID.supabase.co',
    ANON_KEY: '你的anon_key放這裡',
};
```

---

## Step 2：建立資料庫

### 2.1 執行 SQL 腳本

1. 在 Supabase 左側選單點擊 **SQL Editor**
2. 點擊 **New Query**
3. 開啟本專案的 `backend/supabase-schema.sql`，複製全部內容
4. 貼到 SQL Editor
5. 點擊 **Run** 執行

### 2.2 驗證資料表

執行完成後，在左側 **Table Editor** 應該能看到以下資料表：

| 資料表 | 用途 |
|---|---|
| `categories` | 商品分類（食衣住行育樂藝術等） |
| `artists` | 藝術家/創作者資訊 |
| `products` | 商品資料 |
| `flash_sales` | 限時搶購活動 |
| `profiles` | 用戶資料（與 auth.users 關聯） |
| `shipping_addresses` | 收貨地址 |
| `cart_items` | 購物車 |
| `favorites` | 收藏清單 |
| `orders` | 訂單 |
| `order_items` | 訂單項目 |
| `order_status_history` | 訂單狀態歷程 |

---

## Step 3：啟用 OAuth 第三方登入

### 3.1 Google 登入

1. Supabase 左側選單 → **Authentication** → **Providers**
2. 找到 **Google**，開啟開關
3. 填入你的 Google OAuth Client ID 和 Secret
   （在 [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create OAuth 2.0 Client ID 取得）
4. 設定 Authorized redirect URI：`https://你的專案ID.supabase.co/auth/v1/callback`

### 3.2 Apple 登入（選用）

同上，在 Providers 中找到 Apple 啟用。

---

## Step 4：前端頁面串接

### 4.1 在每個 HTML 頁面的 `<head>` 中加入

```html
<!-- Supabase JS SDK -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>

<!-- WAVE ART MALL 後端模組 -->
<script src="backend/supabase-client.js"></script>
<script src="backend/api-service.js"></script>
<script src="backend/page-integrations.js"></script>
```

### 4.2 各頁面初始化

在每個頁面的 `<script>` 底部加入對應的初始化程式碼：

#### 首頁（首頁.md）

```javascript
document.addEventListener('DOMContentLoaded', () => {
    HomePageIntegration.init();
});
```

#### 商品列表（產品介紹.md）

```javascript
document.addEventListener('DOMContentLoaded', () => {
    ProductListIntegration.init();
});
```

#### 商品詳情（購物車/P1.md）

```javascript
document.addEventListener('DOMContentLoaded', () => {
    ProductDetailIntegration.init();
});
```

#### 購物車（收蔵清單.md）

```javascript
document.addEventListener('DOMContentLoaded', () => {
    CartPageIntegration.init();
});
```

#### 結帳（結帳.md）

```javascript
document.addEventListener('DOMContentLoaded', () => {
    CheckoutIntegration.init();
});
```

#### 登入/註冊（基本資料.md）

```javascript
document.addEventListener('DOMContentLoaded', () => {
    AuthPageIntegration.init();
});
```

#### 訂單詳情（訂單詳情.md）

```javascript
document.addEventListener('DOMContentLoaded', () => {
    OrderDetailIntegration.init();
});
```

---

## Step 5：資料庫測試資料

執行 SQL 腳本後，資料庫會自動插入以下測試資料：

### 分類（11個）
特殊節日、食、衣、住、行、育、樂、藝術、運動、美妝、3C

### 藝術家（5位）
NeuroLinker、Archi_Mind、EtherFlow、ZeroG_Art、林偉

### 商品（10件）
包含拍賣品、直購品、限時搶購品，價格從 NT$5,300 到 NT$50,000

### 限時搶購（2個）
Chronos Flow（-30%）、Cyber Origin（-45%）

---

## Step 6：部署上線

### 方案 A：Vercel（推薦，免費）

1. 安裝 Vercel CLI：`npm i -g vercel`
2. 登入：`vercel login`
3. 進入專案目錄：`cd "G:\草稿\待辦事項\APP_!"`
4. 部署：`vercel --prod`
5. 取得公開網址（例如 `https://wave-art-mall.vercel.app`）

### 方案 B：GitHub Pages（純靜態）

1. 把專案 push 到 GitHub
2. 在 Repository Settings → Pages 啟用
3. 選擇 main branch / root 資料夾

### 方案 C：Cloudflare Pages

1. 連結 GitHub 儲存庫
2. 自動部署

---

## API 參考速查

### 商品相關

```javascript
// 取得分類
const { data } = await ProductAPI.getCategories();

// 取得商品列表
const { data } = await ProductAPI.getProducts({
    categorySlug: 'art',
    page: 1,
    limit: 20,
    sortBy: 'price',
    sortOrder: 'desc'
});

// 取得單一商品
const { data } = await ProductAPI.getProductBySlug('celestial-nexus');

// 取得精選商品
const { data } = await ProductAPI.getFeaturedProducts(4);

// 取得限時搶購
const { data } = await ProductAPI.getFlashSales();
```

### 購物車相關

```javascript
// 取得購物車
const { data } = await CartAPI.getCart();

// 加入購物車
await CartAPI.addToCart(productId, 1);

// 更新數量
await CartAPI.updateQuantity(productId, 3);

// 移除商品
await CartAPI.removeFromCart(productId);

// 清空購物車
await CartAPI.clearCart();

// 取得購物車總計
const { subtotal, shipping, tax, total, itemCount } = await CartAPI.getCartTotal();
```

### 訂單相關

```javascript
// 建立訂單
const { orderId } = await OrderAPI.createOrder({
    recipient_name: '王小明',
    phone: '0912345678',
    email: 'ming@example.com',
    city: '台北市',
    district: '信義區',
    street_address: '忠孝東路五段1號',
    postal_code: '110',
    delivery_method: 'home',
    payment_method: 'credit_card'
});

// 取得訂單列表
const { data } = await OrderAPI.getOrders();

// 取得單一訂單
const { data } = await OrderAPI.getOrder(orderId);

// 取消訂單
await OrderAPI.cancelOrder(orderId);
```

### 收藏相關

```javascript
// 切換收藏
const { isFavorited } = await FavoriteAPI.toggleFavorite(productId);

// 取得收藏列表
const { data } = await FavoriteAPI.getFavorites();

// 檢查是否已收藏
const { isFavorited } = await FavoriteAPI.isFavorited(productId);
```

### 認證相關

```javascript
// 註冊
await AuthAPI.signUp(email, password, { username: '小明' });

// 登入
await AuthAPI.signIn(email, password);

// Google 登入
await AuthAPI.signInWithGoogle();

// 登出
await AuthAPI.signOut();

// 取得當前用戶
const user = await AuthManager.getUser();

// 檢查登入狀態
const isLoggedIn = await AuthManager.isLoggedIn();
```

---

## 常見問題

### Q1：為什麼資料讀不出來？

- 檢查 `supabase-client.js` 中的 `URL` 和 `ANON_KEY` 是否正確
- 檢查瀏覽器 Console (F12) 有無紅字錯誤
- 確認資料表已建立且有資料（Supabase Table Editor 查看）

### Q2：未登入用戶的購物車會消失嗎？

不會。未登入用戶的購物車會存在 `localStorage` 中，登入後會自動合併到資料庫。

### Q3：如何新增商品？

方法一：直接在 Supabase Table Editor 中新增 `products` 資料列。

方法二：寫一個簡單的管理後台頁面，呼叫 `supabase.from('products').insert({...})`。

### Q4：圖片存在哪？

目前使用外部圖片網址（Unsplash 等）。如需上傳自訂圖片，可使用 Supabase Storage：

```javascript
const { data, error } = await supabase.storage
    .from('product-images')
    .upload('filename.jpg', file);
```

---

## 安全提醒

1. **不要把 `ANON_KEY` 當成秘密**：它本來就是給前端用的，但請確保啟用了 RLS（Row Level Security），限制用戶只能存取自己的資料。
2. **Service Role Key 絕對不能放前端**：那個 key 可以繞過所有 RLS 限制，只能放在伺服器端。
3. **圖片上傳要限制檔案類型與大小**：避免用戶上傳惡意檔案。

---

**開發順利！** 如有問題，隨時跟我說。
