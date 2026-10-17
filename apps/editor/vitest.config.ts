import { defineConfig } from "vitest/config";
import path from "node:path";

// Load glsl imports as text, like the editor's webpack `asset/source` does, so
// @wavr/core's engine.ts can be imported in a node test context and the
// portable code exports (lib/export.ts) can read the engine's real shaders.
// The tests never touch WebGL.
function glslTextPlugin() {
  return {
    name: "glsl-text",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (id.endsWith(".glsl")) {
        return { code: `export default ${JSON.stringify(code)};`, map: null };
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [glslTextPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
