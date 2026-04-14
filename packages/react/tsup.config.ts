import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    presets: "src/presets.ts",
    "presets-all": "src/presets-all.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  external: ["react", "react-dom"],
  loader: { ".glsl": "text" },
  clean: true,
  treeshake: true,
  sourcemap: true,
});
