import { defineConfig } from "vitest/config";
import path from "node:path";

// @wavr/core imports its shaders as `import src from "./x.glsl"`; the tests
// never compile one, so stub them (as apps/editor/vitest.config.ts does).
function glslStubPlugin() {
  return {
    name: "glsl-stub",
    enforce: "pre" as const,
    transform(_code: string, id: string) {
      if (id.endsWith(".glsl")) return { code: 'export default "";', map: null };
      return null;
    },
  };
}

export default defineConfig({
  plugins: [glslStubPlugin()],
  resolve: {
    // Optional peer, loaded only for the editor overlay; it resolves to a build output.
    alias: { "@wavr/preview": path.resolve(__dirname, "test/stubs/preview.ts") },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["test/**/*.test.{ts,tsx}"],
  },
});
