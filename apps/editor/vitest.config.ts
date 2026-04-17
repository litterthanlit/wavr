import { defineConfig } from "vitest/config";
import path from "node:path";

// Stub glsl imports so @wavr/core's engine.ts can be imported in a node test
// context. The test suite never touches WebGL; the shader sources aren't read.
function glslStubPlugin() {
  return {
    name: "glsl-stub",
    enforce: "pre" as const,
    transform(_code: string, id: string) {
      if (id.endsWith(".glsl")) {
        return { code: "export default \"\";", map: null };
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [glslStubPlugin()],
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
