import { describe, expect, it } from "vitest";
import ts from "typescript";
import { PALETTE_SIZE, bakePalette, effectiveBlend, paletteDomain } from "@wavr/core";
import {
  createPointerState,
  pointerVelocity,
  setPointerPresent,
  setPointerTarget,
  stepPointer,
} from "../../../packages/core/src/pointer";
import { compactCode, indentCode, portableModule, type PortableLanguage } from "./portable-runtime";
import { resolvePortableSettings, type PortableState } from "./portable-shader";
import { createFakeGL } from "./test-utils/fake-webgl";

// These run the generated runtime (the same text the exports embed) against a
// recording fake of WebGL 2, and check what it uploads and draws against the
// engine's own palette and pointer code.

const RAINBOW: [number, number, number][] = [
  [1, 0, 0], [1, 0.65, 0], [1, 1, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1], [0.5, 0, 1], [1, 0, 1],
];

const base: PortableState = {
  colors: [
    [0.388, 0.357, 1],
    [1, 0.42, 0.42],
    [0.251, 0.878, 0.816],
    [0.98, 0.82, 0.2],
  ],
  gradientType: "plasmaOrb",
  speed: 0.4,
  complexity: 3,
  scale: 1,
  distortion: 0.3,
  softness: 0,
  brightness: 1,
  saturation: 1,
};

type Listener = (event: unknown) => void;

/** Runs the generated runtime on a fake canvas, clock and animation-frame loop. */
function launch(overrides: Partial<PortableState> = {}, language: PortableLanguage = "js", options: { noGl?: boolean; scrollLinked?: boolean } = {}) {
  const settings = resolvePortableSettings({ ...base, ...overrides });
  let code = portableModule(settings, language);
  if (language === "ts") {
    // Strip the types: what remains must run exactly like the JavaScript flavour.
    const result = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020 }, reportDiagnostics: true });
    expect(result.diagnostics ?? []).toEqual([]);
    code = result.outputText;
  }

  const fake = createFakeGL();
  const canvasListeners: Record<string, Listener> = {};
  const windowListeners: Record<string, Listener> = {};
  let now = 0;
  let queue: (() => void)[] = [];
  const canvas = Object.assign(fake.canvas, {
    clientWidth: 640,
    clientHeight: 360,
    addEventListener: (type: string, listener: Listener) => {
      canvasListeners[type] = listener;
    },
    removeEventListener: (type: string) => {
      delete canvasListeners[type];
    },
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 640, height: 360 }),
  });
  if (options.noGl) (canvas as unknown as { getContext: () => null }).getContext = () => null;
  const env = {
    document: { hidden: false, documentElement: { scrollHeight: 1000 } },
    window: {
      scrollY: 0,
      innerHeight: 100,
      addEventListener: (type: string, listener: Listener) => {
        windowListeners[type] = listener;
      },
      removeEventListener: (type: string) => {
        delete windowListeners[type];
      },
    },
    performance: { now: () => now },
    requestAnimationFrame: (callback: () => void) => {
      queue.push(callback);
      return queue.length;
    },
    cancelAnimationFrame: () => {
      queue = [];
    },
    devicePixelRatio: 2,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    console,
  };
  const startWavr = new Function(
    "env",
    `const { document, window, performance, requestAnimationFrame, cancelAnimationFrame, devicePixelRatio, ResizeObserver, console } = env;\n${code}\nreturn startWavr;`,
  )(env) as (canvas: unknown, scrollLinked: boolean) => (() => void) | undefined;

  const stop = startWavr(canvas, options.scrollLinked ?? false);
  return {
    settings,
    fake,
    canvas,
    env,
    canvasListeners,
    windowListeners,
    stop,
    /** Advances the clock to `ms` and runs the animation frame that was waiting. */
    step(ms: number) {
      now = ms;
      const due = queue;
      queue = [];
      for (const callback of due) callback();
    },
    /** The uniforms of the latest draw. */
    last: () => fake.draws[fake.draws.length - 1]?.uniforms ?? {},
  };
}

const maxDifference = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  expect(a.length).toBe(b.length);
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
  return worst;
};

describe.each<PortableLanguage>(["js", "ts"])("generated runtime (%s)", (language) => {
  describe("palette", () => {
    const cases: { name: string; state: Partial<PortableState> }[] = [
      { name: "one colour", state: { colors: [[0.2, 0.4, 0.9]] } },
      { name: "the default four, hard stops", state: {} },
      { name: "soft modes: blend from softness", state: { softness: 0.7 } },
      { name: "colour blend", state: { colorBlend: 0.4 } },
      { name: "eight saturated stops in Oklab, blended", state: { colors: RAINBOW, colorBlend: 0.8 } },
      { name: "eight saturated stops in sRGB, blended", state: { colors: RAINBOW, colorBlend: 0.8, oklabEnabled: false } },
      { name: "two stops in sRGB", state: { colors: [[0.1, 0.1, 0.4], [0.9, 0.5, 0.6]], oklabEnabled: false, softness: 0.3 } },
    ];

    for (const { name, state } of cases) {
      it(`bakes the editor's palette: ${name}`, () => {
        const run = launch(state, language);
        const { colors, oklab, softness, colorBlend } = run.settings;
        const blend = effectiveBlend(colorBlend, softness);

        const upload = run.fake.uploads.find((u) => u.call === "texImage2D" && u.format === "RGBA16F");
        expect(upload).toMatchObject({ width: PALETTE_SIZE, height: 1 });
        const expected = bakePalette(colors, oklab, blend);
        expect(maxDifference(upload?.data ?? [], expected)).toBeLessThan(1e-6);

        const domain = paletteDomain(blend);
        run.step(100);
        expect(run.last().u_paletteDomain).toEqual([domain.scale, domain.bias]);
      });
    }

    it("hands the stops to the gradients that read them", () => {
      const wall = launch({ gradientType: "lightWall" }, language);
      wall.step(100);
      expect(wall.last().u_colors).toEqual(base.colors.flat());

      const smoke = launch({ gradientType: "inkSmoke" }, language);
      smoke.step(100);
      expect(smoke.last()).not.toHaveProperty("u_colors");
    });

    it("keeps a Display P3 palette in P3 and presents the canvas so", () => {
      const stops = RAINBOW.slice(0, 5);
      const p3 = launch({ colors: stops, colorProfile: "display-p3" }, language);
      const { colors, oklab, softness, colorBlend } = p3.settings;
      const upload = p3.fake.uploads.find((u) => u.call === "texImage2D" && u.format === "RGBA16F");
      const expected = bakePalette(colors, oklab, effectiveBlend(colorBlend, softness), undefined, true);
      expect(maxDifference(upload?.data ?? [], expected)).toBeLessThan(1e-6);
      expect(p3.fake.context.drawingBufferColorSpace).toBe("display-p3");

      // An sRGB export leaves the canvas as it is.
      expect(launch({ colors: stops }, language).fake.context.drawingBufferColorSpace).toBe("srgb");
    });
  });

  describe("drawing", () => {
    it("sets the canvas size, the clock and the resolution, and draws a strip of two triangles", () => {
      const run = launch({}, language);
      expect([run.canvas.width, run.canvas.height]).toEqual([960, 540]); // 640 x 360 at the pixel ratio, capped at 1.5
      run.step(100);
      expect(run.fake.draws).toHaveLength(1);
      expect(run.last()).toMatchObject({ u_resolution: [960, 540], u_paletteTexture: 0 });
      expect(run.last().u_time).toBeCloseTo(0.1, 9);
      run.step(500);
      expect(run.last().u_time).toBeCloseTo(0.5, 9);
    });

    it("compiles the vertex and fragment shaders it carries", () => {
      const run = launch({ gradientType: "inkSmoke" }, language);
      const program = run.fake.programs[0];
      expect(program.vertexSource).toContain("a_position");
      expect(program.fragmentSource).toContain("vec3 inkSmokeGradient(vec2 uv, float time)");
      expect(program.fragmentSource.startsWith("#version 300 es")).toBe(true);
    });

    it("skips frames closer than 1/45 s, and hidden pages", () => {
      const run = launch({}, language);
      run.step(100);
      run.step(110);
      expect(run.fake.draws).toHaveLength(1);
      run.step(130);
      expect(run.fake.draws).toHaveLength(2);
      run.env.document.hidden = true;
      run.step(300);
      expect(run.fake.draws).toHaveLength(2);
    });

    it("follows the page's scroll in scroll-linked mode", () => {
      const run = launch({}, language, { scrollLinked: true });
      run.env.window.scrollY = 450;
      run.step(100);
      expect(run.last().u_time).toBeCloseTo((450 / 900) * 10, 9);
    });

    it("returns nothing where WebGL 2 is missing", () => {
      expect(launch({}, language, { noGl: true }).stop).toBeUndefined();
    });

    it("stops drawing, and lets go of its listeners, when stopped", () => {
      const run = launch({ mouseReact: 0.5 }, language);
      run.step(100);
      expect(Object.keys(run.canvasListeners).sort()).toEqual(
        ["pointercancel", "pointerdown", "pointerenter", "pointerleave", "pointermove"],
      );
      expect(Object.keys(run.windowListeners)).toEqual(["blur"]);
      run.stop?.();
      expect(run.canvasListeners).toEqual({});
      expect(run.windowListeners).toEqual({});
      run.step(200);
      expect(run.fake.draws).toHaveLength(1);
      expect(run.fake.programs[0].deleted).toBe(true);
      expect(run.fake.deletedTextures).toHaveLength(1); // the palette
    });
  });

  describe("pointer", () => {
    it("is not wired up at all when the pointer is off", () => {
      const run = launch({ mouseReact: 0 }, language);
      run.step(100);
      expect(run.canvasListeners).toEqual({});
      expect(run.windowListeners).toEqual({});
      expect(Object.keys(run.last()).filter((name) => /mouse/i.test(name))).toEqual([]);
    });

    it("smooths, fades and leaves exactly as the engine's pointer does", () => {
      const run = launch({ mouseReact: 0.8 }, language);
      const model = createPointerState();
      const frame = 1000 / 30;
      let ms = 0;
      let lastMs = 0;
      let snapped = false;

      // One frame of the export and of the engine's model, then compare what the shader would see.
      const advance = (label: string) => {
        ms += frame;
        run.step(ms);
        const stillMoving = stepPointer(model, (ms - lastMs) / 1000);
        lastMs = ms;
        // The engine snaps to rest once everything is within a hair of it; the export lets the spring finish.
        snapped ||= !stillMoving;
        const tolerance = snapped ? 3e-3 : 1e-9;
        const [vx, vy] = pointerVelocity(model, run.canvas.width / run.canvas.height);
        const uniforms = run.last();
        const at = (name: string) => uniforms[name] as number[];
        expect(maxDifference(at("u_mouseSmooth"), [model.x.value, model.y.value]), `${label}: position`).toBeLessThan(tolerance);
        expect(maxDifference(at("u_mouseVelocity"), [vx, vy]), `${label}: velocity`).toBeLessThan(tolerance);
        expect(Math.abs((uniforms.u_mousePresence as number) - model.presence.value), `${label}: presence`).toBeLessThan(tolerance);
      };

      // Before the pointer has been seen: absent, so the shader's warp is skipped.
      run.step((ms += frame));
      expect(run.last().u_mousePresence).toBe(0);

      // Enters at (0.25, 0.75) of the element, y up. The element sits at (10, 20), 640 x 360.
      const at = (x: number, y: number) => ({ clientX: 10 + x * 640, clientY: 20 + (1 - y) * 360 });
      lastMs = ms;
      setPointerTarget(model, 0.25, 0.75);
      run.canvasListeners.pointerenter(at(0.25, 0.75));
      for (let i = 0; i < 8; i++) advance(`settling in ${i}`);

      // A jump across the canvas: fast enough to meet the velocity cap.
      setPointerTarget(model, 0.8, 0.3);
      run.canvasListeners.pointermove(at(0.8, 0.3));
      for (let i = 0; i < 8; i++) advance(`jump ${i}`);

      // Leaves: the position stays, the presence fades out.
      setPointerPresent(model, false);
      run.canvasListeners.pointerleave({});
      for (let i = 0; i < 12; i++) advance(`leaving ${i}`);
      expect(run.last().u_mousePresence as number).toBeLessThan(0.1);

      // Comes back close to where it was: starts there, without sweeping across from the old spot.
      setPointerTarget(model, 0.81, 0.31);
      run.canvasListeners.pointerdown(at(0.81, 0.31));
      for (let i = 0; i < 6; i++) advance(`back ${i}`);
      expect(run.last().u_mousePresence as number).toBeGreaterThan(0.5);

      // Losing focus counts as leaving.
      setPointerPresent(model, false);
      run.windowListeners.blur({});
      for (let i = 0; i < 6; i++) advance(`blur ${i}`);
    });

    it("starts at the pointer when it arrives from outside, rather than gliding in from the middle", () => {
      const run = launch({ mouseReact: 0.5 }, language);
      run.canvasListeners.pointerenter({ clientX: 10 + 0.9 * 640, clientY: 20 + 0.1 * 360 });
      run.step(100);
      const [x, y] = run.last().u_mouseSmooth as number[];
      expect(x).toBeCloseTo(0.9, 2);
      expect(y).toBeCloseTo(0.9, 2);
    });

    it("keeps the velocity within the cap the engine hands its shaders", () => {
      const run = launch({ mouseReact: 1 }, language);
      run.canvasListeners.pointerenter({ clientX: 10, clientY: 20 });
      run.step(100);
      run.canvasListeners.pointermove({ clientX: 10 + 640, clientY: 20 + 360 });
      run.step(140);
      const [vx, vy] = run.last().u_mouseVelocity as number[];
      expect(Math.hypot(vx, vy)).toBeLessThanOrEqual(6 + 1e-9);
    });
  });
});

describe("indentCode", () => {
  it("indents code but not the lines of a template literal", () => {
    const code = "const a = 1;\nconst B = `#version 300 es\n  void main() {}\n`;\n\nconst c = `one` + 2;\nconst d = \"\\`\";";
    expect(indentCode(code, "  ")).toBe(
      "  const a = 1;\n  const B = `#version 300 es\n  void main() {}\n`;\n\n  const c = `one` + 2;\n  const d = \"\\`\";",
    );
  });
});

describe("compactCode", () => {
  it("drops comments, indentation and blank lines, and nothing else", () => {
    expect(compactCode("// header\nconst a = 1; // one\n\n  if (a) {\n    run();\n  }\n")).toBe("const a = 1;\nif (a) {\nrun();\n}");
  });
});
