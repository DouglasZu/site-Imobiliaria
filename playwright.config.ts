import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const externalSmokeEnabled = process.env.PLAYWRIGHT_EXTERNAL_SMOKE === "1";
const inheritedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  )
);

const webServerEnvironment = externalSmokeEnabled
  ? inheritedEnvironment
  : {
      ...inheritedEnvironment,
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
      CONTACT_EMAIL: "",
      PUSHER_APP_ID: "",
      PUSHER_SECRET: "",
      PUSHER_KEY: "",
      PUSHER_CLUSTER: "",
      NEXT_PUBLIC_PUSHER_KEY: "",
      NEXT_PUBLIC_PUSHER_CLUSTER: "",
      R2_ACCOUNT_ID: "",
      R2_ACCESS_KEY_ID: "",
      R2_SECRET_ACCESS_KEY: "",
      R2_BUCKET_NAME: "",
      R2_PUBLIC_URL: "",
      CRON_SECRET: "",
    };

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
    env: webServerEnvironment,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    timeout: 120000,
  },
});
