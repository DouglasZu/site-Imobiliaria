import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: process.env.PLAYWRIGHT_PRODUCTION
      ? "npm run start"
      : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer:
      process.env.PLAYWRIGHT_REUSE_SERVER === "1" ||
      (!process.env.CI && !process.env.PLAYWRIGHT_PRODUCTION),
    timeout: 120000,
  },
});
