/**
 * WAVE ART MALL - Supabase 客戶端配置
 * 使用方式：在 HTML 的 <head> 中引入 Supabase CDN，然後引入此檔案
 *
 * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 * <script src="backend/supabase-client.js"></script>
 */

// ============================================
// 配置區 - 請修改為你的 Supabase 專案資訊
// ============================================
const SUPABASE_CONFIG = {
    // 從 Supabase Dashboard > Project Settings > API 取得
    URL: 'https://tfyxaesejdfxykdalcsj.supabase.co',        // WAVE ART MALL 專案 URL
    ANON_KEY: 'sb_publishable_Sa-csa_ReGMUprDwE1eNow_vtXyYfH0',                // ← 請填入你的 anon/public key（以 eyJhbG... 開頭）
};

// ============================================
// 初始化 Supabase 客戶端
// ============================================
let supabaseClient = null;

function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('Supabase JS library not loaded. Please include the CDN script first.');
        return null;
    }

    if (!supabaseClient) {
        supabaseClient = supabase.createClient(
            SUPABASE_CONFIG.URL,
            SUPABASE_CONFIG.ANON_KEY,
            {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true
                }
            }
        );
        console.log('Supabase client initialized');
    }
    return supabaseClient;
}

// 自動初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
} else {
    initSupabase();
}

// ============================================
// 認證狀態管理
// ============================================
const AuthManager = {
    // 取得當前用戶
    async getUser() {
        const client = initSupabase();
        if (!client) return null;
        const { data: { user }, error } = await client.auth.getUser();
        if (error) {
            console.error('Get user error:', error.message);
            return null;
        }
        return user;
    },

    // 取得當前 Session
    async getSession() {
        const client = initSupabase();
        if (!client) return null;
        const { data: { session }, error } = await client.auth.getSession();
        if (error) {
            console.error('Get session error:', error.message);
            return null;
        }
        return session;
    },

    // 監聽認證狀態變化
    onAuthStateChange(callback) {
        const client = initSupabase();
        if (!client) return;
        client.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    },

    // 檢查是否已登入
    async isLoggedIn() {
        const user = await this.getUser();
        return !!user;
    }
};

// ============================================
// 通用 API 錯誤處理
// ============================================
function handleApiError(error, context = '') {
    console.error(`API Error ${context}:`, error);
    return {
        success: false,
        error: error?.message || '發生未知錯誤',
        code: error?.code || 'UNKNOWN'
    };
}

// ============================================
// 本地儲存輔助（用於未登入時的購物車）
// ============================================
const LocalStorage = {
    prefix: 'wave_art_mall_',

    get(key) {
        try {
            const data = localStorage.getItem(this.prefix + key);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    },

    remove(key) {
        localStorage.removeItem(this.prefix + key);
    },

    // 訪客購物車
    getGuestCart() {
        return this.get('guest_cart') || [];
    },

    setGuestCart(cart) {
        return this.set('guest_cart', cart);
    },

    clearGuestCart() {
        this.remove('guest_cart');
    }
};
