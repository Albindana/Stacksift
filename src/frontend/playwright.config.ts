import { defineConfig, devices } from "@playwright/test";

// REAL_STACK=1 switches Playwright to the real-stack journey: it points at an
// already-running composed stack (real Keycloak + API + ES) via
// PLAYWRIGHT_BASE_URL and does NOT boot the mock `pnpm dev` webServer. Unset
// (the default) keeps the fast mock suite — same behaviour as before.
const REAL_STACK = process.env.REAL_STACK === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: REAL_STACK
    ? [
        // Logs in once through real Keycloak (ROPC) and saves storageState.
        {
          name: "real-setup",
          testMatch: /real-stack\/auth\.setup\.ts/,
          use: { ...devices["Desktop Chrome"] },
        },
        // The complete value-loop journey, starting authenticated.
        {
          name: "real-stack",
          testMatch: /real-stack\/.*\.spec\.ts/,
          dependencies: ["real-setup"],
          use: {
            ...devices["Desktop Chrome"],
            storageState: "e2e/.auth/user.json",
          },
        },
      ]
    : [
        // Default fast mock suite — never runs the real-stack specs.
        {
          name: "chromium",
          testIgnore: /real-stack\//,
          use: { ...devices["Desktop Chrome"] },
        },
      ],
  // Mock webServer only in the default mode. In real mode the composed stack is
  // already up on :3000 (booting `pnpm dev` here would collide on the port).
  webServer: REAL_STACK
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_PUBLIC_AUTH_MOCK: "true",
          NEXT_PUBLIC_SIGNALR_MOCK: "true",
        },
      },
});
