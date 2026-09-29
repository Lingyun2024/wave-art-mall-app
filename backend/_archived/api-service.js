/**
 * WAVE ART MALL - API 服務層
 * 封裝所有 Supabase 資料庫操作
 *
 * 依賴：supabase-client.js
 */

// ============================================
// 商品 API
// ============================================
const ProductAPI = {
    // 取得所有啟用中的分類
    async getCategories() {
        const client = initSupabase();
        if (!client) return handleApiError(null, 'getCategories');

        const { data, error } = await client
            .from('categories')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) return handleApiError(error, 'getCategories');
        return { success: true, data };
    },

    // 取得商品列表（支援分頁、分類篩選、排序）
    async getProducts(options = {}) {
        const client = initSupabase();
        if (!client) return handleApiError(null, 'getProducts');

        const {
            categorySlug = null,
            page = 1,
            limit = 20,
            sortBy = 'created_at',
            sortOrder = 'desc',
            searchQuery = null,
            featuredOnly = false,
            flashSaleOnly = false,
            minPrice = null,
            maxPrice = null
        } = options;

        let query = client
            .from('products')
            .select('*, category:categories(*), artist:artists(*)')
            .eq('status', 'active');

        // 分類篩選
        if (categorySlug) {
            const { data: cat } = await client
                .from('categories')
                .select('id')
                .eq('slug', categorySlug)
                .single();
            if (cat) {
                query = query.eq('category_id', cat.id);
            }
        }

        // 精選商品
        if (featuredOnly) {
            query = query.eq('is_featured', true);
        }

        // 限時搶購
        if (flashSaleOnly) {
            query = query.eq('is_flash_sale', true);
        }

        // 價格區間
        if (minPrice !== null) {
            query = query.gte('price', minPrice);
        }
        if (maxPrice !== null) {
            query = query.lte('price', maxPrice);
        }

        // 搜尋
        if (searchQuery) {
            query = query.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
        }

        // 排序與分頁
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) return handleApiError(error, 'getProducts');
        return { success: true, data, page, limit };
    },

    // 取得單一商品詳情
    async getProductBySlug(slug) {
        const client = initSupabase();
        if (!client) return handleApiError(null, 'getProductBySlug');

        const { data, error } = await client
            .from('products')
            .select('*, category:categories(*), artist:artists(*)')
            .eq('slug', slug)
            .eq('status', 'active')
            .single();

        if (error) return handleApiError(error, 'getProductBySlug');
        return { success: true, data };
    },

    // 取得精選商品（首頁推薦用）
    async getFeaturedProducts(limit = 4) {
        const client = initSupabase();
        if (!client) return handleApiError(null, 'getFeaturedProducts');

        const { data, error } = await client
            .from('products')
            .select('*, category:categories(name, slug), artist:artists(name, handle)')
            .eq('status', 'active')
            .eq('is_featured', true)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) return handleApiError(error, 'getFeaturedProducts');
        return { success: true, data };
    },

    // 取得限時搶購商品
    async getFlashSales() {
        const client = initSupabase();
        if (!client) return handleApiError(null, 'getFlashSales');

        const { data, error } = await client
            .from('flash_sales')
            .select('*, product:products(*)')
            .eq('is_active', true)
            .lte('start_at', new Date().toISOString())
            .gte('end_at', new Date().toISOString())
            .order('end_at', { ascending: true });

        if (error) return handleApiError(error, 'getFlashSales');
        return { success: true, data };
    }
};

// ============================================
// 購物車 API
// ============================================
const CartAPI = {
    // 取得購物車內容
    async getCart() {
        const user = await AuthManager.getUser();

        if (user) {
            // 已登入：從資料庫取得
            const client = initSupabase();
            const { data, error } = await client
                .from('cart_items')
                .select('*, product:products(*)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) return handleApiError(error, 'getCart');
            return { success: true, data };
        } else {
            // 未登入：從 localStorage 取得
            const guestCart = LocalStorage.getGuestCart();

            // 如果有商品，查詢商品詳情
            if (guestCart.length > 0) {
                const client = initSupabase();
                const productIds = guestCart.map(item => item.product_id);
                const { data: products } = await client
                    .from('products')
                    .select('*')
                    .in('id', productIds);

                const enrichedCart = guestCart.map(item => ({
                    ...item,
                    product: products?.find(p => p.id === item.product_id) || null
                }));
                return { success: true, data: enrichedCart };
            }

            return { success: true, data: [] };
        }
    },

    // 加入購物車
    async addToCart(productId, quantity = 1) {
        const user = await AuthManager.getUser();

        if (user) {
            const client = initSupabase();
            const { data, error } = await client
                .from('cart_items')
                .upsert({
                    user_id: user.id,
                    product_id: productId,
                    quantity: quantity
                }, {
                    onConflict: 'user_id,product_id',
                    ignoreDuplicates: false
                })
                .select('*, product:products(*)');

            if (error) return handleApiError(error, 'addToCart');
            return { success: true, data };
        } else {
            // 未登入：存入 localStorage
            const cart = LocalStorage.getGuestCart();
            const existingIndex = cart.findIndex(item => item.product_id === productId);

            if (existingIndex >= 0) {
                cart[existingIndex].quantity += quantity;
            } else {
                cart.push({ product_id: productId, quantity, created_at: new Date().toISOString() });
            }

            LocalStorage.setGuestCart(cart);
            return { success: true, data: cart };
        }
    },

    // 更新購物車數量
    async updateQuantity(productId, quantity) {
        if (quantity < 1) {
            return this.removeFromCart(productId);
        }

        const user = await AuthManager.getUser();

        if (user) {
            const client = initSupabase();
            const { data, error } = await client
                .from('cart_items')
                .update({ quantity })
                .eq('user_id', user.id)
                .eq('product_id', productId)
                .select('*, product:products(*)');

            if (error) return handleApiError(error, 'updateQuantity');
            return { success: true, data };
        } else {
            const cart = LocalStorage.getGuestCart();
            const index = cart.findIndex(item => item.product_id === productId);
            if (index >= 0) {
                cart[index].quantity = quantity;
                LocalStorage.setGuestCart(cart);
            }
            return { success: true, data: cart };
        }
    },

    // 從購物車移除
    async removeFromCart(productId) {
        const user = await AuthManager.getUser();

        if (user) {
            const client = initSupabase();
            const { error } = await client
                .from('cart_items')
                .delete()
                .eq('user_id', user.id)
                .eq('product_id', productId);

            if (error) return handleApiError(error, 'removeFromCart');
            return { success: true };
        } else {
            const cart = LocalStorage.getGuestCart().filter(item => item.product_id !== productId);
            LocalStorage.setGuestCart(cart);
            return { success: true };
        }
    },

    // 清空購物車
    async clearCart() {
        const user = await AuthManager.getUser();

        if (user) {
            const client = initSupabase();
            const { error } = await client
                .from('cart_items')
                .delete()
                .eq('user_id', user.id);

            if (error) return handleApiError(error, 'clearCart');
            return { success: true };
        } else {
            LocalStorage.clearGuestCart();
            return { success: true };
        }
    },

    // 合併訪客購物車到用戶購物車（登入後呼叫）
    async mergeGuestCart() {
        const user = await AuthManager.getUser();
        if (!user) return { success: false, error: '未登入' };

        const guestCart = LocalStorage.getGuestCart();
        if (guestCart.length === 0) return { success: true };

        const client = initSupabase();
        const items = guestCart.map(item => ({
            user_id: user.id,
            product_id: item.product_id,
            quantity: item.quantity
        }));

        const { error } = await client
            .from('cart_items')
            .upsert(items, { onConflict: 'user_id,product_id' });

        if (error) return handleApiError(error, 'mergeGuestCart');

        LocalStorage.clearGuestCart();
        return { success: true };
    },

    // 取得購物車總計
    async getCartTotal() {
        const { success, data } = await this.getCart();
        if (!success) return { success: false, error: data };

        let subtotal = 0;
        let itemCount = 0;

        for (const item of data) {
            const price = item.product?.price || 0;
            const qty = item.quantity || 1;
            subtotal += price * qty;
            itemCount += qty;
        }

        const shipping = subtotal > 5000 ? 0 : 1200;
        const tax = Math.round(subtotal * 0.05);
        const total = subtotal + shipping + tax;

        return {
            success: true,
            subtotal,
            shipping,
            tax,
            total,
            itemCount
        };
    }
};

// ============================================
// 收藏 API
// ============================================
const FavoriteAPI = {
    // 取得收藏列表
    async getFavorites() {
        const user = await AuthManager.getUser();
        if (!user) return { success: false, error: '請先登入', data: [] };

        const client = initSupabase();
        const { data, error } = await client
            .from('favorites')
            .select('*, product:products(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) return handleApiError(error, 'getFavorites');
        return { success: true, data };
    },

    // 切換收藏狀態
    async toggleFavorite(productId) {
        const user = await AuthManager.getUser();
        if (!user) return { success: false, error: '請先登入', isFavorited: false };

        const client = initSupabase();

        // 檢查是否已收藏
        const { data: existing } = await client
            .from('favorites')
            .select('id')
            .eq('user_id', user.id)
            .eq('product_id', productId)
            .single();

        if (existing) {
            // 取消收藏
            const { error } = await client
                .from('favorites')
                .delete()
                .eq('id', existing.id);

            if (error) return handleApiError(error, 'toggleFavorite');
            return { success: true, isFavorited: false };
        } else {
            // 加入收藏
            const { error } = await client
                .from('favorites')
                .insert({ user_id: user.id, product_id: productId });

            if (error) return handleApiError(error, 'toggleFavorite');
            return { success: true, isFavorited: true };
        }
    },

    // 檢查是否已收藏
    async isFavorited(productId) {
        const user = await AuthManager.getUser();
        if (!user) return { success: true, isFavorited: false };

        const client = initSupabase();
        const { data, error } = await client
            .from('favorites')
            .select('id')
            .eq('user_id', user.id)
            .eq('product_id', productId)
            .single();

        if (error && error.code !== 'PGRST116') {
            return handleApiError(error, 'isFavorited');
        }

        return { success: true, isFavorited: !!data };
    }
};

// ============================================
// 訂單 API
// ============================================
const OrderAPI = {
    // 建立訂單
    async createOrder(orderData) {
        const user = await AuthManager.getUser();
        if (!user) return { success: false, error: '請先登入' };

        const client = initSupabase();

        const { data, error } = await client.rpc('create_order_from_cart', {
            p_user_id: user.id,
            p_recipient_name: orderData.recipient_name,
            p_phone: orderData.phone,
            p_email: orderData.email,
            p_city: orderData.city,
            p_district: orderData.district,
            p_street_address: orderData.street_address,
            p_postal_code: orderData.postal_code || '',
            p_delivery_method: orderData.delivery_method || 'home',
            p_payment_method: orderData.payment_method,
            p_shipping_fee: orderData.shipping_fee || 1200,
            p_tax_rate: orderData.tax_rate || 0.05
        });

        if (error) return handleApiError(error, 'createOrder');
        return { success: true, orderId: data };
    },

    // 取得訂單列表
    async getOrders() {
        const user = await AuthManager.getUser();
        if (!user) return { success: false, error: '請先登入', data: [] };

        const client = initSupabase();
        const { data, error } = await client
            .from('orders')
            .select('*, order_items(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) return handleApiError(error, 'getOrders');
        return { success: true, data };
    },

    // 取得單一訂單
    async getOrder(orderId) {
        const user = await AuthManager.getUser();
        if (!user) return { success: false, error: '請先登入' };

        const client = initSupabase();
        const { data, error } = await client
            .from('orders')
            .select('*, order_items(*), order_status_history(*)')
            .eq('id', orderId)
            .eq('user_id', user.id)
            .single();

        if (error) return handleApiError(error, 'getOrder');
        return { success: true, data };
    },

    // 取消訂單
    async cancelOrder(orderId) {
        const user = await AuthManager.getUser();
        if (!user) return { success: false, error: '請先登入' };

        const client = initSupabase();
        const { data, error } = await client
            .from('orders')
            .update({ status: 'cancelled' })
            .eq('id', orderId)
            .eq('user_id', user.id)
            .eq('status', 'pending')
            .select();

        if (error) return handleApiError(error, 'cancelOrder');

        // 記錄狀態變更
        if (data) {
            await client.from('order_status_history').insert({
                order_id: orderId,
                status: 'cancelled',
                note: '用戶取消訂單'
            });
        }

        return { success: true, data };
    }
};

// ============================================
// 用戶資料 API
// ============================================
const ProfileAPI = {
    // 取得用戶資料
    async getProfile() {
        const user = await AuthManager.getUser();
        if (!user) return { success: false, error: '請先登入' };

        const client = initSupabase();
        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) return handleApiError(error, 'getProfile');
        return { success: true, data };
    },

    // 更新用戶資料
    async updateProfile(updates) {
        const user = await AuthManager.getUser();
        if (!user) return { success: false, error: '請先登入' };

        const client = initSupabase();
        const { data, error } = await client
            .from('profiles')
            .update(updates)
            .eq('id', user.id)
            .select();

        if (error) return handleApiError(error, 'updateProfile');
        return { success: true, data };
    },

    // 取得收貨地址
    async getAddresses() {
        const user = await AuthManager.getUser();
        if (!user) return { success: false, error: '請先登入', data: [] };

        const client = initSupabase();
        const { data, error } = await client
            .from('shipping_addresses')
            .select('*')
            .eq('user_id', user.id)
            .order('is_default', { ascending: false });

        if (error) return handleApiError(error, 'getAddresses');
        return { success: true, data };
    },

    // 新增收貨地址
    async addAddress(addressData) {
        const user = await AuthManager.getUser();
        if (!user) return { success: false, error: '請先登入' };

        const client = initSupabase();

        // 如果是第一個地址，設為預設
        const { count } = await client
            .from('shipping_addresses')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

        const isDefault = count === 0;

        const { data, error } = await client
            .from('shipping_addresses')
            .insert({
                user_id: user.id,
                ...addressData,
                is_default: addressData.is_default || isDefault
            })
            .select();

        if (error) return handleApiError(error, 'addAddress');
        return { success: true, data };
    }
};

// ============================================
// 認證 API
// ============================================
const AuthAPI = {
    // 電子郵件註冊
    async signUp(email, password, metadata = {}) {
        const client = initSupabase();
        if (!client) return handleApiError(null, 'signUp');

        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: metadata
            }
        });

        if (error) return handleApiError(error, 'signUp');
        return { success: true, data };
    },

    // 電子郵件登入
    async signIn(email, password) {
        const client = initSupabase();
        if (!client) return handleApiError(null, 'signIn');

        const { data, error } = await client.auth.signInWithPassword({
            email,
            password
        });

        if (error) return handleApiError(error, 'signIn');

        // 合併訪客購物車
        await CartAPI.mergeGuestCart();

        return { success: true, data };
    },

    // Google 登入
    async signInWithGoogle(redirectUrl = window.location.origin) {
        const client = initSupabase();
        if (!client) return handleApiError(null, 'signInWithGoogle');

        const { data, error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl
            }
        });

        if (error) return handleApiError(error, 'signInWithGoogle');
        return { success: true, data };
    },

    // Apple 登入
    async signInWithApple(redirectUrl = window.location.origin) {
        const client = initSupabase();
        if (!client) return handleApiError(null, 'signInWithApple');

        const { data, error } = await client.auth.signInWithOAuth({
            provider: 'apple',
            options: {
                redirectTo: redirectUrl
            }
        });

        if (error) return handleApiError(error, 'signInWithApple');
        return { success: true, data };
    },

    // 登出
    async signOut() {
        const client = initSupabase();
        if (!client) return handleApiError(null, 'signOut');

        const { error } = await client.auth.signOut();
        if (error) return handleApiError(error, 'signOut');
        return { success: true };
    },

    // 發送密碼重設郵件
    async resetPassword(email) {
        const client = initSupabase();
        if (!client) return handleApiError(null, 'resetPassword');

        const { data, error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html'
        });

        if (error) return handleApiError(error, 'resetPassword');
        return { success: true, data };
    }
};
