# 部署「忘记密码」功能 + 恢复营业 清单（内嵌版）

> 目标：让 wave-art-mall 上线「忘记密码」自助流程，并确认能正常接新单。
> **重要设计变更（2026-08-11 22:20 更新）**：
> 因 Vercel CLI 增量上传会漏掉「全新文件」（auth.html 能更新、新文件永远传不上去），
> 已把「重设密码」表单**直接内嵌进 `pages/auth.html`**，不再使用独立新文件。
> 这样只需部署 `auth.html`（它本来就能正常上传），彻底绕开上传坑。

---

## 步骤 1：把改动部署到 Vercel

只需部署 `pages/auth.html`（已存在的文件，CLI 能正常上传）：

```bash
# 在项目根目录（G:\草稿\待辦事項\APP_!）执行
npx vercel --prod
```
- 若问 `? Which project?` → 选 `Search all projects` → `wave-art-mall`
- 若问 `.env.local` → 选 `n`
- 结尾看到 `✓ Ready` / `Production: https://wave-art-mall.vercel.app` 即成功

> 注：之前反复失败的 `pwreset.html`（新文件）已废弃、不再引用，无需理会；本次改动全在 auth.html。

---

## 步骤 2：Supabase 后台加 Redirect 白名单（⚠️ 必须做，否则重设链接打不开）

1. 打开 https://supabase.com/dashboard/project/tfyxaesejdfxykdalcsj/auth/url-configuration
2. 找到 **Redirect URLs**（重定向网址）一栏
3. 确认/新增一行：`https://wave-art-mall.vercel.app/pages/auth.html`
4. 保存

> 若这一行之前已存在（例如「补寄验证信」也指向 auth.html），则无需重复添加。

---

## 步骤 3：确认 Auth 邮件能寄出（免费版易进垃圾邮件）

1. 打开 https://supabase.com/dashboard/project/tfyxaesejdfxykdalcsj/auth/email-templates
2. 看「Reset Password」模板是否存在（默认有）
3. 若你有自定义 SMTP：到 `Authentication → SMTP Settings` 确认已填且测试通过
4. 若用 Supabase 免费发信：从 `supabase.co` 网域寄出，客户需检查**垃圾邮件**

---

## 步骤 4：自己实测整条流程（务必做，别直接交给客户）

用一个**真实老客户邮箱**（你确信之前注册过的）走一遍：
1. 打开 https://wave-art-mall.vercel.app/pages/auth.html
2. 点「忘记密码？」→ 输入该邮箱 → 收到重设信
3. 点信里链接 → 回到 auth.html 并自动显示「设定新密码」表单 → 设新密码 → 提示重登入
4. 确认能正常浏览、加购物车、进入结算

✅ 全通过 = 功能 OK，可通知客户
❌ 任一步卡住 = 把卡住的现象告诉我，我帮你查

---

## 步骤 5（可选）：登录后加一句提示，避免老客户困惑

老客户登入后会看到**空白账号**（历史订单/收藏/地址都没了）。
可在 `auth.html` 登录成功后加一句提示，例如：
> 「系统升级中，历史订单暂不可用，请重新下单，造成不便敬请见諒。」

需要的话我直接帮你改 `auth.html` 的 `redirectAfterAuth` 逻辑加这段文案。

---

## 完成判定的检查表
- [ ] 改动已部署（线上登录页能看到「忘记密码？」）
- [ ] Supabase Redirect URLs 已含 `https://wave-art-mall.vercel.app/pages/auth.html`
- [ ] 用一个老客户邮箱实测重设流程通过
- [ ] （可选）登录后提示文案已加
- [ ] 之前给的 PAT `sbp_2347...` 已删除
