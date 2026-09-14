import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseArgs } from "../src/args";
import { scaffold } from "../src/scaffold";

const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("parseArgs", () => {
  it("defaults to hero/aurora", () => {
    expect(parseArgs([])).toMatchObject({ dir: "wavr-landing", template: "hero", preset: "aurora" });
  });

  it("ignores a bare -- separator", () => {
    expect(parseArgs(["--", "site", "--template", "html"])).toMatchObject({
      dir: "site",
      template: "html",
    });
  });

  it("parses template, preset, and link", () => {
    const options = parseArgs(["site", "--template", "waitlist", "--preset", "ocean", "--link", "/workspace"]);
    expect(options).toMatchObject({
      dir: "site",
      template: "waitlist",
      preset: "ocean",
      link: "/workspace",
    });
  });

  it("rejects unknown templates", () => {
    expect(() => parseArgs(["--template", "nope"])).toThrow(/Unknown template/);
  });
});

describe("scaffold", () => {
  it("creates a hero Next app with config, apply API, and skills", () => {
    const dir = path.join(mkdtempSync(path.join(tmpdir(), "wavr-")), "hero");
    temps.push(path.dirname(dir));
    scaffold({ dir, template: "hero", preset: "sunset", link: null, help: false });

    const config = readFileSync(path.join(dir, "wavr.config.ts"), "utf8");
    expect(config).toContain("sunset");
    expect(readFileSync(path.join(dir, "app/page.tsx"), "utf8")).toContain("WavrBackground");
    const background = readFileSync(path.join(dir, "components/WavrBackground.tsx"), "utf8");
    expect(background).toContain("showEditor");
    expect(background).not.toContain("isDev");
    expect(readFileSync(path.join(dir, "app/api/wavr-config/route.ts"), "utf8")).toContain("wavr.config.ts");
    expect(readFileSync(path.join(dir, ".cursor/skills/wavr/SKILL.md"), "utf8")).toContain("name: wavr");
    expect(readFileSync(path.join(dir, "package.json"), "utf8")).toContain("@wavr/gradient");
  });

  it("uses pnpm link: protocol for --link so local rebuilds are picked up", () => {
    const dir = path.join(mkdtempSync(path.join(tmpdir(), "wavr-")), "linked");
    temps.push(path.dirname(dir));
    scaffold({ dir, template: "hero", preset: "aurora", link: "/workspace", help: false });
    const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies["@wavr/gradient"]).toBe("link:/workspace/packages/react");
    expect(pkg.dependencies["@wavr/preview"]).toBe("link:/workspace/packages/preview");
  });

  it("creates an html preview when the IIFE exists", () => {
    const dir = path.join(mkdtempSync(path.join(tmpdir(), "wavr-")), "html");
    temps.push(path.dirname(dir));
    try {
      scaffold({ dir, template: "html", preset: "ocean", link: null, help: false });
    } catch (error) {
      if (error instanceof Error && error.message.includes("IIF")) return;
      throw error;
    }
    const html = readFileSync(path.join(dir, "index.html"), "utf8");
    expect(html).toContain("presets.ocean");
  });

  it("refuses a non-empty directory", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "wavr-"));
    temps.push(dir);
    mkdirSync(path.join(dir, "keep"), { recursive: true });
    writeFileSync(path.join(dir, "keep", "x.txt"), "nope");
    expect(() =>
      scaffold({ dir, template: "hero", preset: "aurora", link: null, help: false }),
    ).toThrow(/non-empty/);
  });
});
