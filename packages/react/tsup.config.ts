import { defineConfig } from "tsup";

const shared = {
  format: ["esm", "cjs"] as const,
  dts: true,
  external: ["react", "react-dom", "@wavr/preview"],
  noExternal: ["@wavr/core"],
  loader: { ".glsl": "text" as const },
  treeshake: true,
  sourcemap: true,
};

export default defineConfig([
  {
    ...shared,
    entry: {
      index: "src/index.ts",
      presets: "src/presets.ts",
      "presets-all": "src/presets-all.ts",
    },
    clean: true,
  },
  {
    ...shared,
    entry: {
      editor: "src/editor.ts",
    },
    clean: false,
  },
]);
