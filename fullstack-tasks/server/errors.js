/**
 * errors.js —— 型別化錯誤體系 + 全域錯誤處理中介層
 *
 * 原則：
 *  1. 業務層只丟「已知錯誤」（AppError 家族），帶 HTTP 狀態與機器可讀的 code。
 *  2. 未知錯誤一律視為 500，對外只回通用訊息，絕不外洩堆疊或內部細節。
 *  3. 客戶端永遠拿到同一種結構：{ error: { code, message, requestId } }
 */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true; // 已知錯誤的訊息可安全回傳給客戶端
  }

  toJSON(requestId) {
    const payload = { code: this.code, message: this.message };
    if (this.details) payload.details = this.details;
    if (requestId) payload.requestId = requestId;
    return payload;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "請求格式錯誤", details) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export class ValidationError extends AppError {
  constructor(details, message = "輸入驗證失敗") {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "請先登入", code = "UNAUTHORIZED") {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "權限不足") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "找不到資源") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "資源衝突", code = "CONFLICT") {
    super(409, code, message);
  }
}

/** PostgreSQL 唯一鍵衝突代碼 */
export const PG_UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(err, constraint) {
  if (!err || typeof err !== "object") return false;
  if (err.code !== PG_UNIQUE_VIOLATION) return false;
  return !constraint || String(err.message ?? "").includes(constraint);
}

/** Express 4 需要這種簽名才會被當成錯誤中介層 */
export function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    const requestId = req.requestId;
    const known = err instanceof AppError;

    if (!known) {
      logger.error("未處理的例外", {
        errName: err?.name,
        errMessage: err?.message,
        stack: err?.stack,
      });
    } else if (err.status >= 500) {
      logger.error("業務錯誤（5xx）", { code: err.code, errMessage: err.message });
    } else {
      logger.warn("業務錯誤（4xx）", { code: err.code, errMessage: err.message });
    }

    if (res.headersSent) return;

    const status = known ? err.status : 500;
    const body = known
      ? err.toJSON(requestId)
      : { code: "INTERNAL_ERROR", message: "伺服器發生錯誤，請稍後再試", requestId };

    res.status(status).json({ error: body });
  };
}
