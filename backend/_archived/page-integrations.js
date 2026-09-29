/**
 * WAVE ART MALL - 前端頁面整合程式碼
 * 每個函數對應一個頁面的資料載入與互動邏輯
 *
 * 使用方式：在對應頁面的 <script> 標籤中呼叫這些函數
 */

// ============================================
// 工具函數
// ============================================
function formatPrice(price, currency = 'NT$') {
    if (price === null || price === undefined) return '-';
    return currency + ' ' + parseInt(price).toLocaleString('zh-TW');
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-TW');
}

function showLoading(element, text = '載入中...') {
    if (!element) return;
    element.innerHTML = `<div class="text-center py-12 text-on-surface-variant"><span class="material-symbols-outlined animate-spin">refresh</span><p class="mt-2 font-label-sm">${text}</p></div>`;
}

function showError(element, message = '載入失敗，請稍後再試') {
    if (!element) return;
    element.innerHTML = `<div class="text-center py-12 text-error"><span class="material-symbols-outlined">error</span><p class="mt-2 font-label-sm">${message}</p></div>`;
}

function showEmpty(element, message = '暫無資料') {
    if (!element) return;
    element.innerHTML = `<div class="text-center py-12 text-on-surface-variant"><span class="material-symbols-outlined text-4xl">inbox</span><p class="mt-2 font-label-sm">${message}</p></div>`;
}

// ============================================
// 1. 首頁整合 (首頁.md)
// ============================================
const HomePageIntegration = {
    // 載入分類圖示到首頁分類區
    async loadCategories() {
        const container = document.querySelector('.grid.grid-cols-5');
        if (!container) return;

        showLoading(container);

        const { success, data } = await ProductAPI.getCategories();
        if (!success || !data || data.length === 0) {
            // 保留原始靜態內容
            return;
        }

        // 重新渲染分類（保留前11個）
        const iconMap = {
            'celebration': 'celebration',
            'restaurant': 'restaurant',
            'apparel': 'apparel',
            'home': 'home',
            'directions_car': 'directions_car',
            'school': 'school',
            'videogame_asset': 'videogame_asset',
            'palette': 'palette',
            'fitness_center': 'fitness_center',
            'face': 'face',
            'devices': 'devices'
        };

        let html = '';
        data.forEach((cat, index) => {
            const isSpecial = cat.slug === 'special-events';
            const icon = iconMap[cat.icon] || 'category';
            const colorClass = isSpecial ? 'text-error' : (cat.slug === 'art' ? 'text-neon-cyan' : 'text-secondary');
            const bgClass = isSpecial ? 'bg-error-container/20 border-error/30' : (cat.slug === 'art' ? 'bg-neon-cyan/10 border-neon-cyan/30' : 'bg-secondary/10 border-secondary/30');

            html += `
            <div class="flex flex-col items-center gap-2 group cursor-pointer" onclick="window.location.href='產品介紹.html?category=${cat.slug}'">
                <div class="w-12 h-12 ${bgClass} rounded-full flex items-center justify-center border group-hover:bg-secondary/20 transition-all">
                    <span class="material-symbols-outlined ${colorClass}">${icon}</span>
                </div>
                <span class="font-label-sm text-[10px] text-on-surface-variant">${cat.name}</span>
            </div>`;
        });

        container.innerHTML = html;
    },

    // 載入限時搶購商品
    async loadFlashSales() {
        const container = document.querySelector('#flash-sale-container');
        if (!container) return;

        showLoading(container);

        const { success, data } = await ProductAPI.getFlashSales();
        if (!success || !data || data.length === 0) {
            showEmpty(container, '目前沒有限時搶購');
            return;
        }

        let html = '';
        data.forEach(sale => {
            const product = sale.product;
            const soldPercent = Math.min(100, Math.round((sale.sold_count / sale.stock_limit) * 100));
            const isSoldOut = soldPercent >= 100;

            html += `
            <div class="min-w-[160px] snap-start glass-card p-2 rounded-xl cursor-pointer" onclick="window.location.href='購物車/P1.html?slug=${product.slug}'">
                <div class="relative aspect-square overflow-hidden rounded-lg mb-2">
                    <img alt="${product.name}" class="w-full h-full object-cover" src="${product.main_image_url}">
                    <div class="absolute top-1 left-1 bg-error text-white text-[10px] px-1.5 py-0.5 rounded font-bold">-${sale.discount_percent}%</div>
                </div>
                <div class="space-y-1">
                    <div class="text-secondary font-bold text-sm">${formatPrice(sale.sale_price)}</div>
                    <div class="text-[10px] text-on-surface-variant line-through">${formatPrice(product.original_price || product.price)}</div>
                    <div class="w-full h-1 bg-surface-container rounded-full overflow-hidden mt-2">
                        <div class="h-full bg-error" style="width: ${soldPercent}%"></div>
                    </div>
                    <div class="text-[9px] ${isSoldOut ? 'text-error' : 'text-on-surface-variant'}">${isSoldOut ? '已搶光' : `已售 ${soldPercent}%`}</div>
                </div>
            </div>`;
        });

        container.innerHTML = html;
    },

    // 載入推薦商品（為你推薦）
    async loadRecommendedProducts() {
        const container = document.querySelector('#recommended-products-container');
        if (!container) return;

        showLoading(container);

        const { success, data } = await ProductAPI.getProducts({ featuredOnly: true, limit: 4 });
        if (!success || !data || data.length === 0) {
            showEmpty(container);
            return;
        }

        let html = '';
        data.forEach(product => {
            html += `
            <div class="glass-card rounded-xl overflow-hidden group cursor-pointer" onclick="window.location.href='購物車/P1.html?slug=${product.slug}'">
                <div class="aspect-square relative overflow-hidden">
                    <img alt="${product.name}" class="w-full h-full object-cover transition-transform group-hover:scale-105" src="${product.main_image_url}">
                </div>
                <div class="p-3 space-y-2">
                    <h4 class="font-body-md text-sm text-starlight-white truncate">${product.name}</h4>
                    <div class="flex justify-between items-center">
                        <span class="text-secondary font-bold">${formatPrice(product.price)}</span>
                        <span class="material-symbols-outlined text-sm text-on-surface-variant cursor-pointer hover:text-red-500" onclick="event.stopPropagation(); toggleFavorite('${product.id}', this)">favorite</span>
                    </div>
                </div>
            </div>`;
        });

        container.innerHTML = html;
    },

    // 載入 Hero 區精選商品
    async loadFeaturedHero() {
        const { success, data } = await ProductAPI.getProducts({ featuredOnly: true, limit: 1 });
        if (!success || !data || data.length === 0) return;

        const product = data[0];
        const heroSection = document.querySelector('section img[data-alt*="Featured"]')?.closest('section');
        if (!heroSection) return;

        const img = heroSection.querySelector('img');
        const title = heroSection.querySelector('h2');
        const bidBtn = heroSection.querySelector('button:first-of-type');

        if (img) img.src = product.main_image_url;
        if (img) img.alt = product.name;
        if (title) title.textContent = product.name;
        if (bidBtn) {
            bidBtn.onclick = () => window.location.href = `購物車/P1.html?slug=${product.slug}`;
        }
    },

    // 初始化首頁所有資料
    async init() {
        await Promise.all([
            this.loadCategories(),
            this.loadFlashSales(),
            this.loadRecommendedProducts(),
            this.loadFeaturedHero()
        ]);

        // 更新購物車數量徽章
        this.updateCartBadge();
    },

    // 更新購物車數量徽章
    async updateCartBadge() {
        const { success, itemCount } = await CartAPI.getCartTotal();
        if (success && itemCount > 0) {
            // 可以在購物車圖示上顯示數量
            const cartBtn = document.querySelector('[data-icon="shopping_cart"]')?.closest('button');
            if (cartBtn) {
                const badge = cartBtn.querySelector('.cart-badge') || document.createElement('span');
                badge.className = 'cart-badge absolute -top-1 -right-1 w-4 h-4 bg-error text-white text-[10px] rounded-full flex items-center justify-center';
                badge.textContent = itemCount;
                if (!cartBtn.querySelector('.cart-badge')) {
                    cartBtn.style.position = 'relative';
                    cartBtn.appendChild(badge);
                }
            }
        }
    }
};

// ============================================
// 2. 商品分類/列表頁整合 (產品介紹.md)
// ============================================
const ProductListIntegration = {
    currentPage: 1,
    currentCategory: null,
    currentSort: 'created_at.desc',

    async init() {
        // 解析 URL 參數
        const params = new URLSearchParams(window.location.search);
        this.currentCategory = params.get('category');
        const searchQuery = params.get('q');

        if (this.currentCategory) {
            // 更新頁面標題
            const { data: cat } = await ProductAPI.getCategories();
            const category = cat?.find(c => c.slug === this.currentCategory);
            if (category) {
                const titleEl = document.querySelector('h2');
                if (titleEl) titleEl.innerHTML = `${category.name} <span class="text-secondary">/ ${category.name.toUpperCase()}</span>`;
            }
        }

        await this.loadProducts();
        this.setupFilters();
    },

    async loadProducts() {
        const grid = document.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3');
        if (!grid) return;

        showLoading(grid);

        const [sortBy, sortOrder] = this.currentSort.split('.');
        const { success, data } = await ProductAPI.getProducts({
            categorySlug: this.currentCategory,
            page: this.currentPage,
            limit: 12,
            sortBy,
            sortOrder
        });

        if (!success || !data || data.length === 0) {
            showEmpty(grid, '此分類暫無商品');
            return;
        }

        let html = '';
        data.forEach(product => {
            const isAuction = product.is_auction;
            const priceLabel = isAuction ? '當前出價' : '售價';
            const priceColor = isAuction ? 'text-secondary' : 'text-neon-cyan';
            const btnText = isAuction ? '參與競標' : '立即購買';
            const btnClass = isAuction
                ? 'bg-secondary text-void-black'
                : 'border border-secondary text-secondary hover:bg-secondary hover:text-void-black';
            const tagClass = isAuction ? 'bg-galactic-purple' : 'bg-neon-cyan text-void-black';
            const tagText = isAuction ? '拍賣中' : '直購';

            html += `
            <div class="glass-card group flex flex-col h-full cursor-pointer" onclick="window.location.href='../購物車/P1.html?slug=${product.slug}'">
                <div class="art-frame relative aspect-[4/5] overflow-hidden">
                    <img class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" src="${product.main_image_url}" alt="${product.name}">
                    <div class="absolute top-4 right-4 z-20">
                        <button class="w-10 h-10 bg-void-black/80 backdrop-blur-md border border-secondary/30 flex items-center justify-center hover:text-red-500 transition-colors" onclick="event.stopPropagation(); toggleFavorite('${product.id}', this)">
                            <span class="material-symbols-outlined">favorite</span>
                        </button>
                    </div>
                    <div class="absolute bottom-4 left-4 z-20">
                        <span class="px-3 py-1 ${tagClass} text-starlight-white font-label-sm text-[10px] uppercase tracking-widest">${tagText}</span>
                    </div>
                </div>
                <div class="p-6 flex flex-col gap-4 flex-grow">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-headline-lg-mobile text-headline-lg-mobile text-starlight-white group-hover:text-secondary transition-colors">${product.name}</h3>
                            <p class="font-label-sm text-label-sm text-on-surface-variant mt-1">創作者: ${product.artist?.handle || 'Unknown'}</p>
                        </div>
                    </div>
                    <div class="mt-auto border-t border-secondary/10 pt-4 flex justify-between items-center">
                        <div>
                            <p class="font-label-sm text-label-sm text-on-surface-variant uppercase">${priceLabel}</p>
                            <p class="font-label-sm text-lg ${priceColor} font-bold">${formatPrice(product.price)}</p>
                        </div>
                        <button class="${btnClass} px-6 py-2 font-label-sm text-label-sm font-bold uppercase hover:shadow-[0_0_15px_rgba(233,195,73,0.5)] transition-all" onclick="event.stopPropagation(); addToCart('${product.id}')">${btnText}</button>
                    </div>
                </div>
            </div>`;
        });

        grid.innerHTML = html;
    },

    setupFilters() {
        // 排序按鈕
        const sortButtons = document.querySelectorAll('button');
        sortButtons.forEach(btn => {
            if (btn.textContent.includes('新品上市')) {
                btn.onclick = () => { this.currentSort = 'created_at.desc'; this.loadProducts(); };
            } else if (btn.textContent.includes('價格由高至低')) {
                btn.onclick = () => { this.currentSort = 'price.desc'; this.loadProducts(); };
            } else if (btn.textContent.includes('熱門程度')) {
                btn.onclick = () => { this.currentSort = 'sold_count.desc'; this.loadProducts(); };
            }
        });
    }
};

// ============================================
// 3. 商品詳情頁整合 (購物車/P1.md)
// ============================================
const ProductDetailIntegration = {
    currentProduct: null,

    async init() {
        const params = new URLSearchParams(window.location.search);
        const slug = params.get('slug');

        if (!slug) {
            showError(document.querySelector('main'), '商品不存在');
            return;
        }

        const { success, data } = await ProductAPI.getProductBySlug(slug);
        if (!success || !data) {
            showError(document.querySelector('main'), '商品載入失敗');
            return;
        }

        this.currentProduct = data;
        this.renderProduct(data);
        this.checkFavoriteStatus(data.id);
    },

    renderProduct(product) {
        // 更新商品名稱
        const titleEl = document.querySelector('h2');
        if (titleEl) titleEl.innerHTML = product.name;

        // 更新價格
        const priceEl = document.querySelector('.text-3xl.font-bold');
        if (priceEl) priceEl.textContent = formatPrice(product.price);

        const originalPriceEl = priceEl?.nextElementSibling;
        if (originalPriceEl && product.original_price) {
            originalPriceEl.textContent = formatPrice(product.original_price);
        }

        // 更新主圖
        const mainImg = document.querySelector('img[data-alt*="Luxurious"]');
        if (mainImg) mainImg.src = product.main_image_url;

        // 更新描述
        const descEl = document.querySelector('.glass-card p:first-child');
        if (descEl) descEl.textContent = product.description || '';

        // 更新系列名稱
        const seriesEl = document.querySelector('h4');
        if (seriesEl && product.series_name) {
            seriesEl.innerHTML = `${product.series_name}<br><span class="text-on-surface-variant text-xs">${product.edition_info || '限量版'}</span>`;
        }

        // 重新綁定「加入購物車」與「直接購買」按鈕
        document.querySelectorAll('button').forEach(btn => {
            const text = btn.textContent.trim();
            if (text.includes('加入購物車')) {
                btn.onclick = (e) => { e.stopPropagation(); this.addToCart(); };
            }
            if (text.includes('直接購買') || text.includes('立即珍藏')) {
                btn.onclick = (e) => { e.stopPropagation(); this.buyNow(); };
            }
        });
    },

    async addToCart() {
        if (!this.currentProduct) return;

        const { success, error } = await CartAPI.addToCart(this.currentProduct.id, 1);
        if (success) {
            alert('已加入購物車！');
        } else {
            alert('加入購物車失敗：' + error);
        }
    },

    buyNow() {
        this.addToCart().then(() => {
            window.location.href = '../收蔵清單.html';
        });
    },

    async checkFavoriteStatus(productId) {
        const { isFavorited } = await FavoriteAPI.isFavorited(productId);
        // 更新愛心圖示狀態
    }
};

// ============================================
// 4. 購物車頁面整合 (收蔵清單.md)
// ============================================
const CartPageIntegration = {
    cartItems: [],

    async init() {
        await this.loadCart();
    },

    async loadCart() {
        const itemsContainer = document.querySelector('.lg\\:col-span-2');
        if (!itemsContainer) return;

        showLoading(itemsContainer);

        const { success, data } = await CartAPI.getCart();
        if (!success) {
            showError(itemsContainer, '載入購物車失敗');
            return;
        }

        this.cartItems = data || [];

        if (this.cartItems.length === 0) {
            itemsContainer.innerHTML = `
                <div class="text-center py-20">
                    <span class="material-symbols-outlined text-6xl text-on-surface-variant/30">shopping_cart</span>
                    <p class="mt-4 font-headline-lg text-on-surface-variant">購物車是空的</p>
                    <button onclick="window.location.href='首頁.html'" class="mt-6 bg-secondary text-void-black px-8 py-3 font-label-sm uppercase">繼續探索</button>
                </div>`;
            this.updateSummary(0, 0, 0, 0);
            return;
        }

        let html = '';
        for (const item of this.cartItems) {
            const product = item.product;
            if (!product) continue;

            html += `
            <div class="glass-card p-6 flex flex-col md:flex-row gap-6 items-center transition-all hover:border-secondary/40" data-product-id="${product.id}">
                <div class="w-full md:w-48 h-48 gold-frame overflow-hidden flex-shrink-0 cursor-pointer" onclick="window.location.href='購物車/P1.html?slug=${product.slug}'">
                    <img class="w-full h-full object-cover" src="${product.main_image_url}" alt="${product.name}">
                </div>
                <div class="flex-grow space-y-2 text-center md:text-left">
                    <h2 class="font-headline-lg text-headline-lg text-starlight-white">${product.name}</h2>
                    <p class="font-label-sm text-label-sm text-secondary/80">${product.series_name || product.artist?.name || ''}</p>
                    <p class="font-body-md text-on-surface-variant mt-2">${product.edition_info || '限量版'}</p>
                </div>
                <div class="flex flex-col items-end gap-4">
                    <div class="text-secondary font-headline-lg text-2xl">${formatPrice(product.price)}</div>
                    <div class="flex items-center border border-secondary/30 rounded-full px-4 py-1">
                        <button class="hover:text-neon-cyan transition-colors" onclick="CartPageIntegration.updateQty('${product.id}', -1)"><span class="material-symbols-outlined text-sm">remove</span></button>
                        <span class="mx-4 font-label-sm text-lg qty-value">${item.quantity}</span>
                        <button class="hover:text-neon-cyan transition-colors" onclick="CartPageIntegration.updateQty('${product.id}', 1)"><span class="material-symbols-outlined text-sm">add</span></button>
                    </div>
                    <button class="text-on-surface-variant/50 hover:text-red-400 transition-colors flex items-center gap-1" onclick="CartPageIntegration.removeItem('${product.id}')">
                        <span class="material-symbols-outlined text-sm">delete</span>
                        <span class="font-label-sm text-xs">移除作品</span>
                    </button>
                </div>
            </div>`;
        }

        itemsContainer.innerHTML = html;
        this.updateSummaryFromCart();
    },

    async updateQty(productId, delta) {
        const item = this.cartItems.find(i => i.product?.id === productId);
        if (!item) return;

        const newQty = item.quantity + delta;
        if (newQty < 1) {
            await this.removeItem(productId);
            return;
        }

        const { success } = await CartAPI.updateQuantity(productId, newQty);
        if (success) {
            item.quantity = newQty;
            const qtyEl = document.querySelector(`[data-product-id="${productId}"] .qty-value`);
            if (qtyEl) qtyEl.textContent = newQty;
            this.updateSummaryFromCart();
        }
    },

    async removeItem(productId) {
        const { success } = await CartAPI.removeFromCart(productId);
        if (success) {
            const el = document.querySelector(`[data-product-id="${productId}"]`);
            if (el) {
                el.style.opacity = '0';
                el.style.transform = 'translateX(100px)';
                setTimeout(() => this.loadCart(), 300);
            }
        }
    },

    updateSummaryFromCart() {
        let subtotal = 0;
        for (const item of this.cartItems) {
            subtotal += (item.product?.price || 0) * item.quantity;
        }
        const shipping = subtotal > 5000 ? 0 : 1200;
        const tax = Math.round(subtotal * 0.05);
        const total = subtotal + shipping + tax;
        this.updateSummary(subtotal, shipping, tax, total);
    },

    updateSummary(subtotal, shipping, tax, total) {
        const summaryEls = document.querySelectorAll('.glass-card p');
        // 根據結構找到對應元素並更新
        const container = document.querySelector('.lg\\:col-span-1 .glass-card');
        if (!container) return;

        const spans = container.querySelectorAll('span');
        // 更新各項金額
        // 這裡需要根據實際 DOM 結構調整
    }
};

// ============================================
// 5. 結帳頁面整合 (結帳.md / 訂單摘要.md)
// ============================================
const CheckoutIntegration = {
    cartItems: [],
    cartTotal: {},

    async init() {
        // 載入購物車內容到訂單摘要
        await this.loadCartSummary();

        // 載入用戶預設地址
        await this.loadDefaultAddress();

        // 綁定確認下單按鈕
        this.bindSubmitButton();
    },

    async loadCartSummary() {
        const { success, data } = await CartAPI.getCart();
        const { success: totalSuccess, subtotal, shipping, tax, total } = await CartAPI.getCartTotal();

        if (!success || !data || data.length === 0) {
            alert('購物車是空的，即將返回首頁');
            window.location.href = '首頁.html';
            return;
        }

        this.cartItems = data;
        this.cartTotal = { subtotal, shipping, tax, total };

        // 更新訂單摘要區域
        const orderSection = document.querySelector('section:first-of-type .glass-panel')?.parentElement;
        if (orderSection) {
            let html = '<h2 class="font-label-sm text-label-sm text-secondary uppercase tracking-widest">訂單摘要</h2>';
            for (const item of data) {
                const product = item.product;
                if (!product) continue;
                html += `
                <div class="glass-panel p-4 flex gap-4 mt-2">
                    <div class="w-20 h-20 bg-surface-container-highest flex-shrink-0 border border-secondary/30">
                        <img class="w-full h-full object-cover" src="${product.main_image_url}" alt="${product.name}">
                    </div>
                    <div class="flex-grow flex flex-col justify-center">
                        <h3 class="font-headline-lg-mobile text-[18px] text-starlight-white">${product.name}</h3>
                        <p class="font-label-sm text-secondary mt-1">${formatPrice(product.price)} x ${item.quantity}</p>
                    </div>
                </div>`;
            }
            orderSection.innerHTML = html;
        }

        // 更新總額
        const totalEl = document.querySelector('footer .font-headline-lg-mobile');
        if (totalEl) totalEl.textContent = formatPrice(total);
    },

    async loadDefaultAddress() {
        const user = await AuthManager.getUser();
        if (!user) return;

        const { success, data } = await ProfileAPI.getAddresses();
        if (!success || !data || data.length === 0) return;

        const defaultAddr = data.find(a => a.is_default) || data[0];

        // 自動填入地址欄位
        const nameInput = document.querySelector('input[placeholder*="姓名"]');
        const phoneInput = document.querySelector('input[placeholder*="0912"]');
        const emailInput = document.querySelector('input[type="email"]');
        const citySelect = document.querySelector('select');
        const districtInput = document.querySelector('input[placeholder*="信義區"]');
        const streetInput = document.querySelector('input[placeholder*="忠孝東路"]');
        const zipInput = document.querySelector('input[placeholder*="110"]');

        if (nameInput) nameInput.value = defaultAddr.recipient_name || '';
        if (phoneInput) phoneInput.value = defaultAddr.phone || '';
        if (emailInput) emailInput.value = defaultAddr.email || '';
        if (citySelect) citySelect.value = defaultAddr.city || '台北市';
        if (districtInput) districtInput.value = defaultAddr.district || '';
        if (streetInput) streetInput.value = defaultAddr.street_address || '';
        if (zipInput) zipInput.value = defaultAddr.postal_code || '';
    },

    bindSubmitButton() {
        const submitBtn = document.querySelector('footer button');
        if (!submitBtn) return;

        submitBtn.onclick = async () => {
            // 收集表單資料
            const name = document.querySelector('input[placeholder*="姓名"]')?.value;
            const phone = document.querySelector('input[placeholder*="0912"]')?.value;
            const email = document.querySelector('input[type="email"]')?.value;
            const city = document.querySelector('select')?.value;
            const district = document.querySelector('input[placeholder*="信義區"]')?.value;
            const street = document.querySelector('input[placeholder*="忠孝東路"]')?.value;
            const zip = document.querySelector('input[placeholder*="110"]')?.value;

            // 取得配送方式
            const isHome = document.getElementById('del-home')?.classList.contains('border-neon-cyan');
            const deliveryMethod = isHome ? 'home' : 'store';

            // 取得付款方式
            const paymentRadios = document.querySelectorAll('input[name="payment"]');
            let paymentMethod = 'credit_card';
            paymentRadios.forEach((radio, idx) => {
                if (radio.checked) {
                    paymentMethod = ['credit_card', 'bank_transfer', 'line_pay'][idx] || 'credit_card';
                }
            });

            // 驗證
            if (!name || !phone || !city || !district || !street) {
                alert('請填寫完整的配送資訊');
                return;
            }

            // 建立訂單
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">refresh</span> 處理中...';

            const { success, orderId, error } = await OrderAPI.createOrder({
                recipient_name: name,
                phone,
                email,
                city,
                district,
                street_address: street,
                postal_code: zip,
                delivery_method: deliveryMethod,
                payment_method: paymentMethod,
                shipping_fee: this.cartTotal.shipping || 1200
            });

            if (success && orderId) {
                alert('訂單已建立！');
                window.location.href = `訂單確認.html?order=${orderId}`;
            } else {
                alert('訂單建立失敗：' + (error || '未知錯誤'));
                submitBtn.disabled = false;
                submitBtn.innerHTML = '確認下單 <span class="material-symbols-outlined">rocket_launch</span>';
            }
        };
    }
};

// ============================================
// 6. 登入/註冊頁面整合 (基本資料.md)
// ============================================
const AuthPageIntegration = {
    init() {
        this.bindLoginForm();
        this.bindRegisterForm();
        this.bindSocialLogin();
    },

    bindLoginForm() {
        const form = document.querySelector('#login-section form');
        if (!form) return;

        form.onsubmit = async (e) => {
            e.preventDefault();
            const email = form.querySelector('input[type="email"]')?.value;
            const password = form.querySelector('input[type="password"]')?.value;

            if (!email || !password) {
                alert('請輸入電子郵件與密碼');
                return;
            }

            const btn = form.querySelector('button[type="submit"]') || form.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = '登入中...';
            btn.disabled = true;

            const { success, error } = await AuthAPI.signIn(email, password);

            btn.textContent = originalText;
            btn.disabled = false;

            if (success) {
                alert('登入成功！');
                window.location.href = '首頁.html';
            } else {
                alert('登入失敗：' + (error || '請檢查帳號密碼'));
            }
        };
    },

    bindRegisterForm() {
        const form = document.querySelector('#register-section form');
        if (!form) return;

        form.onsubmit = async (e) => {
            e.preventDefault();
            const name = form.querySelector('input[type="text"]')?.value;
            const email = form.querySelectorAll('input[type="email"]')[0]?.value;
            const password = form.querySelectorAll('input[type="password"]')[0]?.value;
            const terms = form.querySelector('#terms')?.checked;

            if (!name || !email || !password) {
                alert('請填寫所有欄位');
                return;
            }

            if (password.length < 8) {
                alert('密碼至少需要 8 個字元');
                return;
            }

            if (!terms) {
                alert('請同意服務協議與隱私政策');
                return;
            }

            const btn = form.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = '註冊中...';
            btn.disabled = true;

            const { success, error } = await AuthAPI.signUp(email, password, {
                username: name,
                full_name: name
            });

            btn.textContent = originalText;
            btn.disabled = false;

            if (success) {
                alert('註冊成功！請檢查您的電子郵件以驗證帳號。');
                // 切換到登入頁面
                toggleAuth();
            } else {
                alert('註冊失敗：' + (error || '請稍後再試'));
            }
        };
    },

    bindSocialLogin() {
        // Google 登入
        const googleBtn = document.querySelector('button:has(svg path[d*="M12.48"])');
        if (googleBtn) {
            googleBtn.onclick = async () => {
                await AuthAPI.signInWithGoogle();
            };
        }

        // Apple 登入
        const appleBtn = document.querySelector('button:has(svg path[d*="M17.05"])');
        if (appleBtn) {
            appleBtn.onclick = async () => {
                await AuthAPI.signInWithApple();
            };
        }
    }
};

// ============================================
// 7. 訂單確認/詳情頁面整合
// ============================================
const OrderDetailIntegration = {
    async init() {
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get('order');

        if (!orderId) {
            showError(document.querySelector('main'), '找不到訂單資訊');
            return;
        }

        const { success, data } = await OrderAPI.getOrder(orderId);
        if (!success || !data) {
            showError(document.querySelector('main'), '訂單載入失敗');
            return;
        }

        this.renderOrder(data);
    },

    renderOrder(order) {
        // 更新訂單編號
        const orderNumEl = document.querySelector('h1, h2');
        if (orderNumEl) orderNumEl.textContent = `訂單 ${order.order_number}`;

        // 更新狀態
        const statusMap = {
            'pending': '待付款',
            'confirmed': '已確認',
            'processing': '處理中',
            'shipped': '已出貨',
            'delivered': '已送達',
            'cancelled': '已取消',
            'returned': '已退貨'
        };

        // 更新金額
        const totalEl = document.querySelector('.text-secondary.text-2xl, .text-3xl');
        if (totalEl) totalEl.textContent = formatPrice(order.total_amount);
    }
};

// ============================================
// 8. 全局互動函數（供 HTML onclick 呼叫）
// ============================================

// 加入購物車（全局函數）
async function addToCart(productId, quantity = 1) {
    const { success, error } = await CartAPI.addToCart(productId, quantity);
    if (success) {
        // 顯示成功提示
        const toast = document.createElement('div');
        toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 bg-secondary text-void-black px-6 py-3 rounded font-label-sm z-[100] animate-bounce';
        toast.textContent = '已加入購物車！';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    } else {
        alert('加入購物車失敗：' + error);
    }
}

// 切換收藏（全局函數）
async function toggleFavorite(productId, btnElement) {
    const user = await AuthManager.getUser();
    if (!user) {
        const goLogin = confirm('請先登入才能收藏商品。是否前往登入頁面？');
        if (goLogin) window.location.href = '基本資料.html';
        return;
    }

    const { success, isFavorited, error } = await FavoriteAPI.toggleFavorite(productId);
    if (success) {
        const icon = btnElement?.querySelector('.material-symbols-outlined') || btnElement;
        if (icon) {
            icon.style.fontVariationSettings = isFavorited ? "'FILL' 1" : "'FILL' 0";
            icon.classList.toggle('text-red-500', isFavorited);
        }
    } else {
        console.error('Toggle favorite failed:', error);
    }
}

// 更新購物車徽章（全局函數）
async function updateCartBadge() {
    const { success, itemCount } = await CartAPI.getCartTotal();
    const badges = document.querySelectorAll('.cart-badge');
    badges.forEach(badge => {
        if (success && itemCount > 0) {
            badge.textContent = itemCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    });
}

// 登出（全局函數）
async function logout() {
    const { success } = await AuthAPI.signOut();
    if (success) {
        window.location.href = '首頁.html';
    }
}
