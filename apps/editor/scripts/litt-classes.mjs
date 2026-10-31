#!/usr/bin/env node
/**
 * Rewrites the editor's old Wavr palette names to litt's tokens, by the plan's Task 1 table.
 *
 *   node apps/editor/scripts/litt-classes.mjs           rewrite every file in place
 *   node apps/editor/scripts/litt-classes.mjs --check   rewrite nothing; exit 1 and list each old name left
 *
 * It reads apps/editor's .ts, .tsx, .js, .mjs and .css files, skipping litt's own (components/litt, lib/litt),
 * node_modules and build output. A Tailwind class keeps its variants and opacity (`hover:bg-surface/50` becomes
 * `hover:bg-litt-surface-2/50`) under every colour prefix: bg, text, border (and its sides), divide, ring,
 * ring-offset, outline, fill, stroke, from, via, to, shadow, decoration, caret and accent. A CSS
 * `var(--color-<old>)` becomes `var(--litt-<new>)`. `text-base` is Tailwind's 16px size, not the colour, so it stays.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Old name → litt token, without the `litt-` prefix. */
const TABLE = {
  root: "canvas",
  base: "surface-1",
  surface: "surface-2",
  elevated: "surface-3",
  "border-active": "line-strong",
  border: "line",
  "text-primary": "fg",
  "text-secondary": "fg-muted",
  "text-tertiary": "fg-subtle",
  accent: "accent",
  "slider-track": "slot",
  "tick-inactive": "line",
  "tick-base": "data-rose",
  "tick-green": "data-teal",
  "tick-teal": "data-teal",
  "tick-blue": "data-blue",
  "tick-purple": "data-violet",
  "tick-orange": "data-amber",
  "tick-red": "data-rose",
  "pill-bg": "block",
  "pill-border": "line",
};

// Longest names first, so `border-active` wins over `border`.
const NAMES = Object.keys(TABLE).sort((a, b) => b.length - a.length).map((n) => n.replace(/-/g, "\\-"));
const PREFIX = "bg|text|border(?:-[trblxyse])?|divide|ring(?:-offset)?|outline|fill|stroke|from|via|to|shadow|decoration|caret|accent";
// A class: not glued to a longer word on the left, then a colour prefix, an old name, an optional /opacity, and an end.
const CLASS = new RegExp(`(?<![\\w-])(${PREFIX})-(${NAMES.join("|")})(?=(?:/\\d+|/\\[[^\\]]+\\])?(?![\\w-]))`, "g");
const CSS_VAR = new RegExp(`--color-(${NAMES.join("|")})(?![\\w-])`, "g");

const SKIP_DIRS = new Set(["node_modules", ".next", "out", "test-results", "public"]);
const SKIP_PATHS = [path.join(root, "components", "litt"), path.join(root, "lib", "litt"), path.join(root, "scripts")];
const EXT = /\.(?:tsx?|jsx?|mjs|css)$/;

function* files(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || SKIP_PATHS.includes(full)) continue;
      yield* files(full);
    } else if (EXT.test(entry.name)) {
      yield full;
    }
  }
}

/** The alias block in globals.css defines the old names; it is the one place they are allowed to appear. */
const DEFINITION = /^\s*--color-[\w-]+\s*:/;

function rewrite(text) {
  return text
    .split("\n")
    .map((line) =>
      DEFINITION.test(line)
        ? line
        : line.replace(CLASS, (match, prefix, name) => (prefix === "text" && name === "base" ? match : `${prefix}-litt-${TABLE[name]}`)).replace(CSS_VAR, (_, name) => `--litt-${TABLE[name]}`),
    )
    .join("\n");
}

const check = process.argv.includes("--check");
let changed = 0;
const left = [];
for (const file of files(root)) {
  const text = fs.readFileSync(file, "utf8");
  const next = rewrite(text);
  if (next === text) continue;
  if (check) {
    const before = text.split("\n");
    const after = next.split("\n");
    before.forEach((line, i) => {
      if (line !== after[i]) left.push(`${path.relative(root, file)}:${i + 1}: ${line.trim()}`);
    });
  } else {
    fs.writeFileSync(file, next);
    changed++;
  }
}

if (check) {
  if (left.length) {
    console.log(`${left.length} line(s) still use the old palette:\n${left.join("\n")}`);
    process.exit(1);
  }
  console.log("No old palette names left.");
} else {
  console.log(`Rewrote ${changed} file(s).`);
}
