# backend/_archived — 归档说明

以下文件于 **2026-08-11** 从 `backend/` 根目录归档至此，原因：

**线上 WAVE ART MALL 前端并不直接加载这些文件。**
- 线上前端通过 `js/supabaseClient.js` 直连 Supabase，所有页面（加购、下单、收藏、登录）都直接读写数据库。
- 本目录的 `api-service.js` 与 `page-integrations.js` 是早期设想的"后端代理层"，**从未被任何页面引用**，属于孤儿文件。
- 之前"先改后端、结果连不上"的困惑，根因正是：改的是这里，但前端根本没接。

归档内容：
- `api-service.js` — 原后端 API 服务（含 RPC 调用），未被前端加载
- `page-integrations.js` — 原页面集成脚本（含 CheckoutIntegration），未被前端加载
- `INTEGRATION_GUIDE.md` — 上述两文件的集成说明，一并归档

**如需重新启用后端代理层**，应另行规划架构（前端改为调用后端 API，而非直连），并与当前直连方案明确二选一，避免再次产生混淆。
