/**
 * index.js —— 服務進入點
 *
 * 啟動順序：載入設定（缺變數即失敗）→ 連線資料庫 → 監聽埠 → 註冊優雅停機
 */
import { config } from "./config.js";
import { logger, setLogLevel } from "./logger.js";
import { initDb, closeDb } from "./db/client.js";
import { createApp } from "./app.js";

setLogLevel(config.logLevel);

process.on("unhandledRejection", (reason) => {
  logger.error("未處理的 Promise 拒絕", { reason: String(reason) });
});
process.on("uncaughtException", (err) => {
  logger.error("未捕捉的例外", { errMessage: err?.message, stack: err?.stack });
  process.exit(1);
});

async function main() {
  await initDb();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info("服務已啟動", {
      port: config.port,
      env: config.nodeEnv,
      corsOrigins: config.corsOrigins,
      url: `http://localhost:${config.port}`,
    });
  });

  // 逾時保護：避免慢速攻擊占住連線
  server.headersTimeout = 20000;
  server.requestTimeout = 30000;

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("收到停止訊號，開始優雅停機", { signal });

    server.close(async () => {
      try {
        await closeDb();
      } finally {
        logger.info("已停止服務");
        process.exit(0);
      }
    });

    // 最長等 10 秒，逾時強制結束，避免僵住
    setTimeout(() => {
      logger.warn("優雅停機逾時，強制結束");
      process.exit(1);
    }, 10000).unref();
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("啟動失敗", { errMessage: err?.message, stack: err?.stack });
  process.exit(1);
});
