# Supabase SQL 執行清單

## 執行前準備

1. 登入 Supabase Dashboard：https://supabase.com/dashboard
2. 選擇你的專案
3. 左側選單點擊 **SQL Editor**
4. 點擊 **New query**

---

## A1：訂單金額防護（order_amount_guard.sql）

**目的**：防止客戶端偽造訂單金額

**檔案位置**：
```
G:\草稿\待辦事項\APP_!\backend\order_amount_guard.sql
```

**執行步驟**：
1. 開啟上述檔案
2. 全選複製（Ctrl + A，Ctrl + C）
3. 貼到 Supabase SQL Editor
4. 點擊 **Run** 執行

**預期結果**：
- 成功建立 3 個 trigger
- 成功建立 3 個 function
- 新增 1 個 CHECK constraint

**驗證方式**：
```sql
SELECT o.order_number, o.total_amount,
       (SELECT SUM(subtotal) FROM order_items WHERE order_id = o.id) AS items_sum
  FROM orders o
 ORDER BY o.created_at DESC LIMIT 5;
```
→ `total_amount` 應等於 `items_sum`

---

## A2：評價功能 RLS 政策（reviews_policy_patch.sql）

**目的**：讓用戶可以提交訂單評價，並防止沒買過的人亂刷評價

**檔案位置**：
```
G:\草稿\待辦事項\APP_!\backend\reviews_policy_patch.sql
```

**執行步驟**：
1. 開啟上述檔案
2. 全選複製
3. 貼到 Supabase SQL Editor（新開一個 query 或清空上一個）
4. 點擊 **Run** 執行

**預期結果**：
- `reviews` 表啟用 RLS
- 成功建立 4 個 policy
- 成功建立 1 個 unique index

**驗證方式**：
登入後從訂單歷史頁面點「前往評價此訂單商品」→ 應能成功送出評價

---

## A3：火星療癒管理員權限（mars_healing_production.sql）

**目的**：讓管理員（2022lingyun@gmail.com）能看到所有火星療癒登記資料和照片

**檔案位置**：
```
G:\草稿\待辦事項\APP_!\backend\mars_healing_production.sql
```

**執行步驟**：
1. 開啟上述檔案
2. 全選複製
3. 貼到 Supabase SQL Editor
4. 點擊 **Run** 執行

**預期結果**：
- `mars_healing_registrations` 表啟用 RLS
- 成功建立 4 個 table policy
- 成功建立 4 個 storage policy
- 成功設定 `mars-healing-photos` bucket

**驗證方式**：
用管理員帳號登入後開啟：
```
https://wave-art-mall.vercel.app/pages/admin-mars-healing.html
```
→ 應該能看到所有人的火星療癒登記資料

---

## 執行順序

**建議按以下順序執行**（可以一次執行完）：

1. **A1**（訂單金額防護）← 最優先，防止改價攻擊
2. **A2**（評價 RLS）← 次優先，讓評價功能正常運作
3. **A3**（火星療癒管理員權限）← 讓你能看到所有登記資料

---

## 執行後確認

執行完三個 SQL 後，請確認：

### 1. 訂單防護是否生效
在瀏覽器 Console 嘗試偽造 1 元訂單：
```javascript
await supabaseClient.from('orders').insert({
  user_id: (await supabaseClient.auth.getUser()).data.user.id,
  status: '待處理', 
  total_amount: 1, 
  identity_type: null,
  recipient_name: 'test', 
  phone: '0900000000',
  street_address: 'test', 
  city: 'test', 
  district: 'test',
  payment_method: 'bank_transfer'
});
```
→ 預期：成功建立，但 `total_amount` 被改成 `0`

### 2. 評價功能是否正常
- 登入後從訂單歷史點「評價」
- 選擇星級並送出
- 應顯示「感謝您的評價！」

### 3. 火星療癒管理後台是否能看到所有資料
- 用 `2022lingyun@gmail.com` 登入
- 開啟 `https://wave-art-mall.vercel.app/pages/admin-mars-healing.html`
- 點擊「重新載入」
- 應該能看到所有人的登記（不只你自己的）

---

## 常見問題

### Q: 執行後出現錯誤怎麼辦？
A: 請截圖錯誤訊息，可能是：
- 表格不存在（需要先建表）
- 欄位不存在（schema 不符）
- 權限不足（需要 service_role 權限）

### Q: 可以重複執行嗎？
A: 可以。這三個 SQL 都有 `DROP ... IF EXISTS`，重複執行會覆蓋舊版本。

### Q: 如何回滾？
A: 每個 SQL 檔案末尾都有「回滾方式」註解，複製那段執行即可。

---

## 後續任務

執行完 A1、A2、A3 後，還有：

- **A4**：設定 Supabase 每日監控報告（需要在 Dashboard 設定）
- **A5**（如需要）：修復 SMTP 或調整 email 驗證設定
