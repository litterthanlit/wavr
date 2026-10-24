import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // LiftKit generated files
    "src/**",
    // litt.md registry items: tested upstream, installed with `shadcn add`,
    // never edited here (see CLAUDE.md, Editor).
    "components/litt/**",
    "lib/litt/**",
  ]),
]);

export default eslintConfig;
