import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LITT_BUTTON_CLASSES, buttonClassName } from "./litt-button-classes";

const source = readFileSync(path.resolve(__dirname, "../components/litt/button.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** The string literals of `const <name> = …;` in litt's button.tsx, joined as the + concatenation joins them. */
function constant(name: string): string {
  const m = source.match(new RegExp(`const ${name}\\b[^=]*=([\\s\\S]*?);\\n`));
  if (!m) throw new Error(`button.tsx has no const ${name}`);
  return m[1];
}
const joined = (code: string) => [...code.matchAll(/"([^"]*)"/g)].map((s) => s[1]).join("");

/** `key: "…" + "…",` entries of a Record constant. */
function record(name: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of constant(name).matchAll(/(\w+):((?:\s*"[^"]*"\s*\+?)+)/g)) out[m[1]] = joined(m[2]);
  return out;
}

describe("litt button classes", () => {
  it("match litt's Button", () => {
    expect(LITT_BUTTON_CLASSES.base).toBe(joined(constant("base")));
    expect(LITT_BUTTON_CLASSES.sizes).toEqual(record("sizes"));
    const variants = record("variants");
    for (const [variant, classes] of Object.entries(LITT_BUTTON_CLASSES.variants)) expect(classes).toBe(variants[variant]);
  });

  it("put the size and variant on the base with litt's control corner", () => {
    const classes = buttonClassName({ variant: "primary", size: "lg" }).split(" ");
    expect(classes).toContain("bg-litt-accent");
    expect(classes).toContain("h-litt-control-lg");
    expect(classes).toContain("rounded-litt-control");
  });
});
