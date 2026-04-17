import { defineConfig } from "tsup";

// Subpath entries added as each implementation step lands:
//   agent    → step 7 of specs/0001-schema.md §12
export default defineConfig({
  entry: {
    index: "src/index.ts",
    migrate: "src/migrate.ts",
    url: "src/url.ts",
    parity: "src/parity.ts",
    "effects/index": "src/effects/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
});
