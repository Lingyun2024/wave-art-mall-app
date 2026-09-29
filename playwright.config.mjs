import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright 冒煙測試配置
 * - 自啟一個獨立靜態伺服器（port 8766，避開用戶慣用的 8765）
 * - 只跑 chromium；手機 viewport（LINE 內開為主要情境）
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8766",
    ...devices["Pixel 7"],
  },
  projects: [{ name: "chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command:
      '"C:/Users/User/.workbuddy/binaries/python/versions/3.13.12/python.exe" -m http.server 8766 --bind 127.0.0.1',
    url: "http://127.0.0.1:8766/index.html",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
