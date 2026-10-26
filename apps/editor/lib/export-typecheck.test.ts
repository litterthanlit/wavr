import { describe, expect, it } from "vitest";
import path from "node:path";
import ts from "typescript";
import { GRADIENT_TYPES } from "@wavr/core";
import { exportReactComponent, exportStandalonePlayer, exportWebComponent, type ExportableState } from "./export";

// The exported React component goes into other people's TypeScript projects, so
// it has to pass `strict` there, not just run. This compiles it in memory with
// the editor's own React types (and no help from the editor's tsconfig).

const state: ExportableState = {
  colors: [
    [0.388, 0.357, 1],
    [1, 0.42, 0.42],
    [0.251, 0.878, 0.816],
  ],
  gradientType: "inkSmoke",
  speed: 0.4,
  complexity: 3,
  scale: 1,
  distortion: 0.3,
  softness: 0.7,
  brightness: 1,
  saturation: 1,
};

// A file name next to this one, so `react` resolves from the editor's node_modules.
const FILE = path.resolve(__dirname, "WavrGradient.generated.tsx");

function diagnosticsOf(source: string): string[] {
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noImplicitReturns: true,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.dom.d.ts", "lib.esnext.d.ts"],
    types: [],
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options);
  const { getSourceFile, fileExists, readFile } = host;
  host.getSourceFile = (name, languageVersion, ...rest) =>
    path.resolve(name) === FILE
      ? ts.createSourceFile(name, source, languageVersion)
      : getSourceFile.call(host, name, languageVersion, ...rest);
  host.fileExists = (name) => path.resolve(name) === FILE || fileExists.call(host, name);
  host.readFile = (name) => (path.resolve(name) === FILE ? source : readFile.call(host, name));
  const program = ts.createProgram([FILE], options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file && path.resolve(d.file.fileName) === FILE)
    .map((d) => {
      const { line } = d.file!.getLineAndCharacterOfPosition(d.start ?? 0);
      return `${line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`;
    });
}

describe("exported code", () => {
  it("compiles under strict TypeScript: React component, with and without the pointer", () => {
    expect(diagnosticsOf(exportReactComponent({ ...state, mouseReact: 0.6 }))).toEqual([]);
    expect(diagnosticsOf(exportReactComponent({ ...state, gradientType: "lightWall", mouseReact: 0 }))).toEqual([]);
  });

  it("has a checker that notices a mistake", () => {
    expect(diagnosticsOf(`const x: number = "a";\nexport default x;`)).toHaveLength(1);
  });

  it("is valid JavaScript: web component and standalone player, for every gradient", () => {
    for (const type of GRADIENT_TYPES) {
      for (const mouseReact of [0, 0.5]) {
        const input = { ...state, gradientType: type, mouseReact };
        const web = exportWebComponent(input);
        const script = /<script>\n([\s\S]*?)\n<\/script>/.exec(web)?.[1] ?? "";
        expect(() => new Function(script), `${type} web component`).not.toThrow();

        const player = exportStandalonePlayer(input);
        const encoded = /<script src="data:text\/javascript;charset=utf-8,([^"]*)"><\/script>/.exec(player)?.[1] ?? "";
        expect(() => new Function(decodeURIComponent(encoded)), `${type} standalone player`).not.toThrow();
      }
    }
  });
}, 60_000);
