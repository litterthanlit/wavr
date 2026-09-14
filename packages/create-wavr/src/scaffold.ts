import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CliOptions } from "./args";

const require = createRequire(import.meta.url);

export function packageRoot(): string {
  return path.resolve(fileURLToPath(new URL("..", import.meta.url)));
}

export function skillSourceDir(): string {
  const bundled = path.join(packageRoot(), "skill");
  if (existsSync(path.join(bundled, "SKILL.md"))) return bundled;
  const monorepo = path.resolve(packageRoot(), "../../skills/wavr");
  if (existsSync(path.join(monorepo, "SKILL.md"))) return monorepo;
  throw new Error("Wavr skill files were not found. Expected skills/wavr or create-wavr/skill.");
}

export function resolvePreviewIife(): string {
  try {
    return require.resolve("@wavr/preview/iife");
  } catch {
    const fallback = path.resolve(packageRoot(), "../preview/dist/wavr-preview.js");
    if (existsSync(fallback)) return fallback;
    throw new Error("Could not resolve @wavr/preview IIFE. Build @wavr/preview first.");
  }
}

function copyDir(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function writeJson(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function packageNameFromDir(dir: string): string {
  const base = path.basename(path.resolve(dir));
  return base.replace(/[^a-zA-Z0-9-_]/g, "-") || "wavr-landing";
}

function nextPackageJson(dest: string, options: CliOptions): Record<string, unknown> {
  const deps: Record<string, string> = options.link
    ? {
        "@wavr/gradient": `file:${path.resolve(options.link, "packages/react")}`,
        "@wavr/preview": `file:${path.resolve(options.link, "packages/preview")}`,
      }
    : {
        "@wavr/gradient": "^0.1.0",
        "@wavr/preview": "^0.1.0",
      };

  return {
    name: packageNameFromDir(dest),
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
    },
    dependencies: {
      ...deps,
      next: "16.2.1",
      react: "19.2.4",
      "react-dom": "19.2.4",
    },
    devDependencies: {
      "@types/node": "^20",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      typescript: "^5",
    },
  };
}

function copySkill(dest: string): void {
  const skill = skillSourceDir();
  for (const agent of [".cursor", ".claude", ".codex"]) {
    copyDir(skill, path.join(dest, agent, "skills", "wavr"));
  }
}

function writeWavrConfig(dest: string, preset: string): void {
  writeFileSync(
    path.join(dest, "wavr.config.ts"),
    `import type { GradientConfig } from "@wavr/gradient";\nimport { ${preset} } from "@wavr/gradient/presets";\n\nexport const wavrConfig: GradientConfig = ${preset};\n`,
  );
}

function writeAgents(dest: string, template: string): void {
  writeFileSync(
    path.join(dest, "AGENTS.md"),
    `# Wavr landing (${template})

This project uses Wavr for its animated shader background.

- Skill: \`.cursor/skills/wavr/SKILL.md\`
- Config: \`wavr.config.ts\`
- Dev preview includes the compact Wavr editor overlay. Press E to toggle.
- After visual tweaks, click **Apply to project** then re-read \`wavr.config.ts\`.
- Production: keep \`editor={false}\` on \`WavrGradient\`.

Start with \`pnpm dev\` and open the preview.
`,
  );
}

export function scaffold(options: CliOptions): string {
  const dest = path.resolve(options.dir);
  if (existsSync(dest) && readdirSync(dest).length > 0) {
    throw new Error(`Refusing to scaffold into non-empty directory: ${dest}`);
  }
  mkdirSync(dest, { recursive: true });

  const templates = path.join(packageRoot(), "templates");

  if (options.template === "html") {
    copyDir(path.join(templates, "html"), dest);
    const htmlPath = path.join(dest, "index.html");
    const html = readFileSync(htmlPath, "utf8").replaceAll("__PRESET__", options.preset);
    writeFileSync(htmlPath, html);
    cpSync(resolvePreviewIife(), path.join(dest, "wavr-preview.js"));
    copySkill(dest);
    writeAgents(dest, "html");
    return dest;
  }

  copyDir(path.join(templates, "next-base"), dest);
  copyDir(path.join(templates, options.template), dest);
  writeJson(path.join(dest, "package.json"), nextPackageJson(dest, options));
  writeWavrConfig(dest, options.preset);
  copySkill(dest);
  writeAgents(dest, options.template);
  return dest;
}
