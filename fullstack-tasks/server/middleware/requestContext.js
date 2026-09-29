/**
 * requestContext.js —— 為每個請求建立 ID 並注入日誌環境
 *
 * 請求 ID 會：
 *  - 寫入 res 標頭（X-Request-Id），方便前端回報問題時對照
 *  - 自動帶入該請求後續所有 log（不需要逐層傳遞）
 *  - 出現在錯誤回應的 error.requestId 裡
 */
import { randomUUID } from "node:crypto";
import { withContext } from "../logger.js";

export function requestContext(req, res, next) {
  const requestId = req.header("X-Request-Id") || randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  withContext({ requestId, method: req.method, path: req.originalUrl }, () => next());
}
