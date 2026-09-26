import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    noExternal: ["@wavr/core", "@wavr/schema"],
    loader: { ".glsl": "text" },
    clean: true,
    treeshake: true,
    sourcemap: true,
  },
  {
    entry: { "wavr-preview": "src/iife.ts" },
    format: ["iife"],
    globalName: "Wavr",
    noExternal: ["@wavr/core", "@wavr/schema"],
    loader: { ".glsl": "text" },
    platform: "browser",
    outExtension: () => ({ js: ".js" }),
    sourcemap: true,
  },
]);
