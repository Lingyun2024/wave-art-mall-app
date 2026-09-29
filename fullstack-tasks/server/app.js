/**
 * app.js —— 組裝 Express 應用
 *
 * 中介層順序（順序本身就是安全邊界，不可任意調動）：
 *   requestId → CORS → 安全標頭 → JSON 解析 → 存取日誌 → 路由 → 404 → 錯誤處理
 */
import express from "express";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "./config.js";
import { logger } from "./logger.js";
import { errorHandler, NotFoundError } from "./errors.js";
import { requestContext } from "./middleware/requestContext.js";
import { cors, securityHeaders } from "./middleware/security.js";
import { authenticate, requireRole } from "./middleware/authenticate.js";

import * as authController from "./modules/auth/auth.controller.js";
import * as tasksController from "./modules/tasks/tasks.controller.js";
import * as adminController from "./modules/admin/admin.controller.js";
import * as healthController from "./modules/health/health.controller.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = join(ROOT, "public");

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // 若未來放到反向代理後面，需信任 X-Forwarded-For
  app.set("trust proxy", 1);

  app.use(requestContext);
  app.use(cors());
  app.use(securityHeaders());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  // 存取日誌：每筆請求一行 JSON，含狀態碼與耗時
  app.use((req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      logger.info("http_request", {
        status: res.statusCode,
        durationMs: Date.now() - started,
        userAgent: req.header("User-Agent"),
      });
    });
    next();
  });

  // 探測端點：不進 /api 前綴，方便基礎設施直接打
  app.get("/health", healthController.health);
  app.get("/ready", healthController.ready);

  const api = express.Router();

  // ---- 公開端點 ----
  api.post("/auth/register", authController.register);
  api.post("/auth/login", authController.login);
  api.post("/auth/refresh", authController.refresh);
  api.post("/auth/logout", authController.logout);

  // ---- 需登入 ----
  api.get("/auth/me", authenticate, authController.me);
  api.get("/tasks", authenticate, tasksController.list);
  api.post("/tasks", authenticate, tasksController.create);
  api.get("/tasks/:id", authenticate, tasksController.get);
  api.patch("/tasks/:id", authenticate, tasksController.update);
  api.delete("/tasks/:id", authenticate, tasksController.remove);

  // ---- 需管理員 ----
  const admin = express.Router();
  admin.use(authenticate, requireRole("admin"));
  admin.get("/overview", adminController.overview);
  admin.get("/users", adminController.listUsers);
  admin.patch("/users/:id", adminController.updateUser);
  admin.get("/tasks", adminController.listTasks);
  admin.delete("/tasks/:id", adminController.deleteTask);
  api.use("/admin", admin);

  app.use("/api", api);

  // 前端靜態檔（多頁 HTML + Tailwind CDN，沿用範本做法）
  app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

  // 找不到對應路由
  app.use((req, res, next) => next(new NotFoundError("找不到這個路徑")));

  app.use(errorHandler(logger));

  return app;
}

export { config };
