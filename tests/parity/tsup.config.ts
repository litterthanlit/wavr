import { defineConfig } from "tsup";

// Bundle the parity pages (runner.ts for the harness, hdr.ts for its HDR
// output check, snapshot.ts for snapshot.mjs). @wavr/core imports shader sources via
// `import src from "./*.glsl"`, so we wire esbuild's `text` loader for that
// extension (matching the editor's webpack `asset/source` / turbopack
// `raw-loader` behaviour in apps/editor/next.config.ts).
export default defineConfig({
  entry: ["tests/parity/pages/runner.ts", "tests/parity/pages/hdr.ts", "tests/parity/pages/snapshot.ts"],
  outDir: "tests/parity/pages",
  format: ["iife"],
  target: "es2022",
  platform: "browser",
  clean: false,
  sourcemap: false,
  dts: false,
  loader: {
    ".glsl": "text",
  },
});
