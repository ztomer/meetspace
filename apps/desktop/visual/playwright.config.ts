import { defineConfig, devices } from "@playwright/test";

// Visual-regression harness for the desktop UI. Renders the Vite build in
// headless Chromium with Tauri IPC mocked (see support/tauri-mock.ts), and
// captures deterministic pixel snapshots in light and dark mode.
//
//   pnpm -F desktop visual            run + compare against baselines
//   pnpm -F desktop visual:update     refresh baselines (review the diff!)
//
// See docs/VISUAL_TESTING.md.
export default defineConfig({
  testDir: "./specs",
  snapshotDir: "./__snapshots__",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",

  // Determinism: fixed viewport/DPR, no animations, stable threshold.
  use: {
    baseURL: "http://localhost:1422",
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    timezoneId: "UTC",
    locale: "en-US",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    },
  },

  projects: [
    {
      name: "light",
      use: { ...devices["Desktop Chrome"], colorScheme: "light" },
    },
    {
      name: "dark",
      use: { ...devices["Desktop Chrome"], colorScheme: "dark" },
    },
  ],

  // Reuse a running `pnpm -F desktop dev` if present, else start one.
  webServer: {
    command: "pnpm --filter @meetspace/desktop dev",
    url: "http://localhost:1422",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: "../../..",
  },
});
