import { defineConfig } from "@playwright/test";

// Parity harness config. See specs/0002-parity-harness.md §4.
//
// `--use-gl=swiftshader` is the deterministic-goldens lever: without it,
// pixel hashes drift with the host GPU. `workers: 1` + `fullyParallel: false`
// because shader-compile determinism across parallel SwiftShader contexts
// isn't something we want to bet on.
export default defineConfig({
  testDir: ".",
  testMatch: /runner\.test\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  // 10 min per test — SwiftShader on macOS is catastrophically slow for Wavr's
  // ~133KB shader bundle (many effect programs). Linux CI SwiftShader is 10-50x
  // faster and typically completes a test in <15s. This high ceiling lets us run
  // locally for debugging, but goldens are always generated via the CI action
  // (spec 0002 §5 + §10).
  timeout: 600_000,
  use: {
    // Default waitUntil is "load"; we only need domcontentloaded since the runner
    // exposes __wavrReady asynchronously.
    navigationTimeout: 30_000,
    launchOptions: {
      args: [
        // ANGLE's SwiftShader backend is more stable than --use-gl=swiftshader direct.
        "--use-angle=swiftshader",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
      ],
    },
  },
  projects: [
    {
      name: "chromium-swiftshader",
      use: { browserName: "chromium" },
    },
  ],
});
