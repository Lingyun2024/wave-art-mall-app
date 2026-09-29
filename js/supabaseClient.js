/*
  =========================================================
  supabaseClient.js —— 全站共用的 Supabase 连线与工具函式
  =========================================================
  新手说明：
  这个档案是整个网站「跟资料库沟通」的核心枢纽。
  所有页面都会引入这个档案，用里面写好的函式来：
  - 取得目前登入的使用者
  - 加入购物车 / 取消收藏 / 判断是否已收藏
  - 检查登入状态，没登入就导去登入页

  这样每个页面就不用重复写一样的程式码，
  以后要修改逻辑（例如换资料库栏位名称）也只需要改这一个档案。

  【重要】使用方式：
  在每个 html 页面的 <head> 或 <body> 最后面，先引入 Supabase SDK，
  再引入这个档案：
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="../js/supabaseClient.js"></script>
*/

// -----------------------------------------------------
// 第一步：初始化 Supabase 客户端
// -----------------------------------------------------
// 這兩個值是 Supabase 專案給的「連線資訊」，可以想像成是
// 資料庫的地址(URL)和公開的通行證(anon key)。
// anon key 是「公開金鑰」，可以放在前端程式码中，
// 真正的安全防护是靠资料库那边设定的 RLS（Row Level Security，逐行权限）规则。
const SUPABASE_URL = "https://tfyxaesejdfxykdalcsj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Sa-csa_ReGMUprDwE1eNow_vtXyYfH0";

// window.supabase 是从 CDN 载入的 Supabase SDK 全域物件，
// 我们呼叫 .createClient() 来建立一个可以操作资料库的「客户端」实例。
// 之后全站都用这个 supabaseClient 变数来做任何资料库操作。
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -----------------------------------------------------
// 简单的提示訊息工具（Toast）
// -----------------------------------------------------
// 新手说明：alert() 会跳出很丑的系统对话框而且会挡住整个页面操作，
// 所以我们自己写一个简单的「右上角淡出提示框」，比较不会打断使用者。
function showToast(message, type = "success") {
  // 如果页面里还没有放提示框的容器，就自动建立一个
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "toast " + (type === "error" ? "toast-error" : "toast-success");
  toast.textContent = message;
  container.appendChild(toast);

  // 3 秒后自动移除这个提示框，避免堆积在画面上
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// -----------------------------------------------------
// 取得目前登入的使用者
// -----------------------------------------------------
// 回传值：如果有登入，回传 user 物件（包含 id, email 等资讯）；
// 如果没有登入，回传 null。
// 这个函式几乎每个页面都会用到，用来判断「要不要显示登入/登出按钮」。
async function getCurrentUser() {
  try {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) {
      // 没有登入时 Supabase 也可能会回传 error，这里不特别当作严重错误处理
      return null;
    }
    return data.user || null;
  } catch (err) {
    console.error("[getCurrentUser] 取得使用者资讯失败:", err);
    return null;
  }
}

// -----------------------------------------------------
// 检查是否登入，没登入就导去登入页
// -----------------------------------------------------
// 使用情境：例如「加入购物车」「结帐」这些动作必须先登入才能做，
// 我们就呼叫这个函式，如果没登入，会自动跳转到 auth.html，
// 并且把「原本想去的页面」记录起来，登入成功后可以导回去。
async function requireLogin(redirectBackUrl) {
  const user = await getCurrentUser();
  if (!user) {
    // 把目前页面网址记下来，存到 localStorage，
    // 这样登入成功后可以知道要导回哪一页
    const backUrl = redirectBackUrl || window.location.href;
    localStorage.setItem("wave_redirect_after_login", backUrl);
    showToast("請先登入才能進行這個操作", "error");
    setTimeout(() => {
      window.location.href = getPathTo("pages/auth.html");
    }, 800);
    return null;
  }

  // 【重要安全檢查】帳號必須完成 Email 驗證，才能加入購物車或送出訂單。
  // email_confirmed_at 有時間代表使用者已點過驗證信；沒有值就一律拒絕。
  if (!user.email_confirmed_at) {
    const backUrl = redirectBackUrl || window.location.href;
    localStorage.setItem("wave_redirect_after_login", backUrl);
    showToast("請先到 Email 信箱完成驗證，才可以下單", "error");
    setTimeout(() => {
      window.location.href = getPathTo("pages/auth.html?notice=verify-email");
    }, 1200);
    return null;
  }

  return user;
}

// -----------------------------------------------------
// 路径工具：因为专案有 index.html（根目录）和 pages/*.html（子目录）两种层级，
// 这个函式帮我们组出「从目前页面出发」正确的相对路径，避免连结点错地方。
// -----------------------------------------------------
function getPathTo(targetPathFromRoot) {
  // 判断目前页面是不是在 /pages/ 目录下
  const isInPagesFolder = window.location.pathname.includes("/pages/");
  if (isInPagesFolder) {
    // 如果目标本身也是 pages/xxx.html，就只需要留档名
    if (targetPathFromRoot.startsWith("pages/")) {
      return targetPathFromRoot.replace("pages/", "");
    }
    // 如果目标是根目录的 index.html，要往上跳一层
    return "../" + targetPathFromRoot;
  }
  // 目前页面在根目录（index.html），直接照原本路径回传即可
  return targetPathFromRoot;
}

// -----------------------------------------------------
// 加入购物车
// -----------------------------------------------------
// 参数：productId（商品编号）, quantity（数量，预设 1）
// 逻辑：
//   1. 先确认使用者已登入
//   2. 查询 cart_items 里是否已经有这个商品，如果有就把数量加上去
//   3. 如果没有，就新增一笔纪录
async function addToCart(productId, quantity = 1) {
  const user = await requireLogin();
  if (!user) return false; // requireLogin 内部已经处理跳转与提示了

  try {
    // 先查询购物车里是否已经有同一个商品
    const { data: existingItems, error: queryError } = await supabaseClient
      .from("cart_items")
      .select("id, quantity")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .maybeSingle();

    if (queryError) throw queryError;

    if (existingItems) {
      // 已经有这个商品在购物车里 -> 更新数量（累加）
      const { error: updateError } = await supabaseClient
        .from("cart_items")
        .update({ quantity: existingItems.quantity + quantity })
        .eq("id", existingItems.id);
      if (updateError) throw updateError;
    } else {
      // 购物车里还没有这个商品 -> 新增一笔
      const { error: insertError } = await supabaseClient
        .from("cart_items")
        .insert({ user_id: user.id, product_id: productId, quantity });
      if (insertError) throw insertError;
    }

    showToast("已加入购物车");
    // 加入后顺便更新导览列上的购物车数量角标
    updateCartBadge();
    return true;
  } catch (err) {
    console.error("[addToCart] 加入购物车失败:", err);
    showToast("加入购物车失败，请稍后再试", "error");
    return false;
  }
}

// -----------------------------------------------------
// 判断某个商品是否已被目前使用者收藏
// -----------------------------------------------------
// 回传 true / false。如果使用者根本没登入，直接回传 false（还没收藏任何东西）。
async function isFavorited(productId) {
  const user = await getCurrentUser();
  if (!user) return false;

  try {
    const { data, error } = await supabaseClient
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  } catch (err) {
    console.error("[isFavorited] 查询收藏状态失败:", err);
    return false;
  }
}

// -----------------------------------------------------
// 切换收藏状态（已收藏就取消，未收藏就加入）
// -----------------------------------------------------
// 回传值：切换后的状态（true = 现在是已收藏, false = 现在是未收藏），
// 如果失败则回传 null，方便呼叫端判断要不要还原按钮画面。
async function toggleFavorite(productId) {
  const user = await requireLogin();
  if (!user) return null;

  try {
    const { data: existing, error: queryError } = await supabaseClient
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .maybeSingle();
    if (queryError) throw queryError;

    if (existing) {
      // 已经收藏过了 -> 删除这笔收藏纪录（取消收藏）
      const { error: deleteError } = await supabaseClient
        .from("favorites")
        .delete()
        .eq("id", existing.id);
      if (deleteError) throw deleteError;
      showToast("已取消收藏");
      return false;
    } else {
      // 还没收藏过 -> 新增一笔收藏纪录
      const { error: insertError } = await supabaseClient
        .from("favorites")
        .insert({ user_id: user.id, product_id: productId });
      if (insertError) throw insertError;
      showToast("已加入收藏");
      return true;
    }
  } catch (err) {
    console.error("[toggleFavorite] 切换收藏状态失败:", err);
    showToast("操作失败，请稍后再试", "error");
    return null;
  }
}

// -----------------------------------------------------
// 计算目前使用者购物车「总商品件数」，用来显示在导览列的角标
// -----------------------------------------------------
async function getCartCount() {
  const user = await getCurrentUser();
  if (!user) return 0;

  try {
    const { data, error } = await supabaseClient
      .from("cart_items")
      .select("quantity")
      .eq("user_id", user.id);
    if (error) throw error;
    // 把每一笔的数量加总起来（例如 A商品 x2 + B商品 x3 = 5）
    return (data || []).reduce((sum, item) => sum + item.quantity, 0);
  } catch (err) {
    console.error("[getCartCount] 取得购物车数量失败:", err);
    return 0;
  }
}

// 更新页面上购物车角标的数字（如果该页面有放 #cart-badge 这个元素）
async function updateCartBadge() {
  const count = await getCartCount();
  const badgeEls = document.querySelectorAll(".js-cart-badge");
  badgeEls.forEach((el) => {
    if (count > 0) {
      el.textContent = count > 99 ? "99+" : String(count);
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  });
}

// -----------------------------------------------------
// 格式化价格显示，统一显示成 NT$ 1,234 这种千分位格式
// -----------------------------------------------------
function formatPrice(price) {
  const num = Number(price) || 0;
  return "NT$ " + num.toLocaleString("zh-TW");
}

// -----------------------------------------------------
// 简单的 HTML 转义，避免使用者输入的评价内容被当成 HTML 标签执行（防止 XSS）
// -----------------------------------------------------
function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

// -----------------------------------------------------
// 取得网址上的查询参数，例如 product-detail.html?id=5 就可以用
// getQueryParam('id') 拿到 "5"
// -----------------------------------------------------
function getQueryParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}
