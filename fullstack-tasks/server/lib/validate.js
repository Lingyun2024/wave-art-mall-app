/**
 * validate.js —— 邊界輸入驗證（不信任任何客戶端資料）
 *
 * 用法：
 *   const dto = parseBody(req.body, {
 *     email:    { type: "string", required: true, email: true, max: 254 },
 *     password: { type: "string", required: true, min: 8, max: 128 },
 *     status:   { type: "string", oneOf: ["todo", "doing", "done"] },
 *   });
 *
 * 驗證失敗會丟 ValidationError（400 / VALIDATION_ERROR），
 * 由全域錯誤處理器統一轉成 { error: { code, message, details } }。
 */
import { ValidationError } from "../errors.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(details) {
  throw new ValidationError(details);
}

function checkString(value, rule, field, errors) {
  const v = String(value);
  if (rule.min !== undefined && v.length < rule.min) {
    errors.push({ field, reason: `長度不得少於 ${rule.min}` });
  }
  if (rule.max !== undefined && v.length > rule.max) {
    errors.push({ field, reason: `長度不得超過 ${rule.max}` });
  }
  if (rule.email && !EMAIL_RE.test(v)) {
    errors.push({ field, reason: "電子郵件格式不正確" });
  }
  if (rule.oneOf && !rule.oneOf.includes(v)) {
    errors.push({ field, reason: `必須是以下之一：${rule.oneOf.join(" / ")}` });
  }
  if (rule.pattern && !rule.pattern.test(v)) {
    errors.push({ field, reason: "格式不正確" });
  }
  return rule.trim === false ? v : v.trim();
}

function checkNumber(value, rule, field, errors) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    errors.push({ field, reason: "必須是數字" });
    return value;
  }
  if (rule.int && !Number.isInteger(n)) {
    errors.push({ field, reason: "必須是整數" });
  }
  if (rule.min !== undefined && n < rule.min) errors.push({ field, reason: `不得小於 ${rule.min}` });
  if (rule.max !== undefined && n > rule.max) errors.push({ field, reason: `不得大於 ${rule.max}` });
  return n;
}

/**
 * @param {Record<string, unknown>} input
 * @param {Record<string, object>} schema
 * @returns {Record<string, unknown>} 只回傳 schema 內定義過的欄位（杜絕多餘欄位寫入）
 */
export function parse(input, schema) {
  const errors = [];
  const out = {};

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    fail([{ field: "_body", reason: "請求主體必須是 JSON 物件" }]);
  }

  for (const [field, rule] of Object.entries(schema)) {
    const raw = input[field];
    const has = Object.prototype.hasOwnProperty.call(input, field);

    if (!has || raw === undefined || raw === null || raw === "") {
      if (rule.required) {
        errors.push({ field, reason: "此欄位為必填" });
        continue;
      }
      if (rule.default !== undefined) out[field] = rule.default;
      continue;
    }

    if (rule.type === "number") {
      out[field] = checkNumber(raw, rule, field, errors);
    } else if (rule.type === "boolean") {
      if (typeof raw !== "boolean") errors.push({ field, reason: "必須是布林值" });
      else out[field] = raw;
    } else if (rule.type === "date") {
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) errors.push({ field, reason: "日期格式不正確" });
      else out[field] = String(raw).slice(0, 10);
    } else {
      out[field] = checkString(raw, rule, field, errors);
    }
  }

  if (errors.length) fail(errors);
  return out;
}

/** 解析分頁參數，統一限制上下限避免惡意 page_size */
export function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const rawSize = Number.parseInt(String(query.pageSize ?? query.page_size ?? "20"), 10);
  // 只在缺值 / 非數字時回退 20；明確傳 0 仍要被夾到下限 1，不能用 || 20 吃掉
  const pageSize = Math.min(100, Math.max(1, Number.isFinite(rawSize) ? rawSize : 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}
