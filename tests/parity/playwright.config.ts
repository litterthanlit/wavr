import { defineConfig } from "@playwright/test";

// Parity harness config. See specs/0002-parity-harness.md §4.
//
// `--use-gl=swiftshader` is the deterministic-goldens lever: without it,
// pixel hashes drift with the host GPU. `workers: 1` + `fullyParallel: false`
// because shader-compile determinism across parallel SwiftShader contexts
// isn't something we want to bet on.
export default defineConfig({
  testDir: ".",
  testMatch: /(runner|hdr)\.test\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  // 10 min per test — a generous ceiling for slow SwiftShader hosts (macOS).
  // The runner compiles one small program per gradient type plus the post
  // program (about a second each on Linux SwiftShader) before the first test.
  // Goldens are always generated via the CI action (spec 0002 §5 + §10).
  timeout: 600_000,
  use: {
    // Runner script is deferred so goto is not blocked on shader compile, but
    // keep a high ceiling for slow file:// + SwiftShader startups.
    navigationTimeout: 180_000,
    launchOptions: {
      // Use a Chromium that's already on the machine instead of Playwright's
      // own download (same override as `pnpm snapshots`).
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: [
        // ANGLE's SwiftShader backend is more stable than --use-gl=swiftshader direct.
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
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
