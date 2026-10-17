import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GRADIENT_TYPES, GRADIENT_TYPE_IDS } from "@wavr/core";

// Vitest stubs .glsl imports to "", so read the real files.
const SHADER_DIR = path.resolve(__dirname, "../../../packages/core/src/shaders");
const read = (name: string) => fs.readFileSync(path.join(SHADER_DIR, name), "utf8");
const stripComments = (source: string) => source.replace(/\/\/.*$/gm, "");

describe("mouse warp wiring", () => {
  const layer = stripComments(read("layer.glsl"));
  const mouse = stripComments(read("mouse.glsl"));

  it("layer main warps the uv once, right before the gradient, and not the 3D surface uv", () => {
    const main = layer.slice(layer.indexOf("void main()"));
    expect(main.match(/\bmouseWarp\(/g)).toHaveLength(1);
    expect(main.indexOf("mouseWarp(")).toBeLessThan(main.indexOf("computeGradient("));

    // It sits in the else branch of the 3D projection, so projected uvs are left alone.
    const threeD = main.indexOf("if (u_3dEnabled)");
    const warp = main.indexOf("mouseWarp(");
    expect(main.slice(threeD, warp)).toMatch(/\}\s*else\s*\{\s*uv = $/);
    // After parallax and the distortion map.
    expect(main.indexOf("u_parallaxEnabled")).toBeLessThan(warp);
    expect(main.indexOf("u_hasDistortionMap")).toBeLessThan(warp);
  });

  it("every gradient has a warp style, and so does custom GLSL", () => {
    for (const type of GRADIENT_TYPES) {
      const id = GRADIENT_TYPE_IDS[type];
      expect(mouse, type).toMatch(new RegExp(`#(?:el)?if WAVR_GRADIENT == ${id}\\n#define WAVR_MOUSE_WARP mouseWarp\\w+`));
    }
    expect(mouse).toMatch(/#if defined\(WAVR_CUSTOM\)\n#define WAVR_MOUSE_WARP mouseWarp\w+/);
    // A gradient without a line is a compile error rather than a silent no-op.
    expect(mouse).toContain("#error");
  });

  it("only gives the styles listed in the table", () => {
    const styles = [...mouse.matchAll(/^vec2 (mouseWarp(?!\()\w+)\(vec2 uv\)/gm)].map((m) => m[1]);
    expect(styles.sort()).toEqual(["mouseWarpLens", "mouseWarpMagnet", "mouseWarpPush", "mouseWarpSwirl", "mouseWarpWave"]);
    for (const style of styles) {
      expect(mouse.match(new RegExp(`define WAVR_MOUSE_WARP ${style}\\b`)), style).not.toBeNull();
    }
  });

  it("does nothing without the pointer: presence and react gate the warp", () => {
    expect(mouse).toMatch(/if \(u_mouseReact <= 0\.0 \|\| u_mousePresence <= 0\.0\) return uv;/);
    // Every style is scaled by react * presence (through MouseField.amount).
    expect(mouse).toMatch(/f\.amount = react \* clamp\(u_mousePresence, 0\.0, 1\.0\);/);
    expect(mouse.match(/\* f\.amount\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("measures in aspect-correct space", () => {
    expect(mouse).toContain("vec2(u_resolution.x / u_resolution.y, 1.0)");
  });

  it("the old in-gradient displacement functions are gone; mouseWarp is the only way in", () => {
    expect(mouse).not.toMatch(/\b(fluid|vortex|magnet|gravity)Displace\b|\brippleEffect\b/);
  });

  it("parallax is centred, presence-gated and mirrored rather than wrapped", () => {
    expect(layer).toContain("(u_mouseSmooth - 0.5) * u_mousePresence");
    expect(layer).not.toMatch(/fract\(uv \+ offset\)/);
    expect(layer).toContain("1.0 - abs(1.0 - mod(uv + offset, 2.0))");
  });

  it("the mesh vertex lift is aspect-correct, compact and presence-gated", () => {
    const vertex = stripComments(read("vertex.glsl"));
    expect(vertex).toContain("uniform float u_mousePresence;");
    expect(vertex).toContain("u_resolution.x / u_resolution.y");
    expect(vertex).toContain("u_mouseReact * u_mousePresence");
    expect(vertex).not.toContain("exp(");
  });

  it("the post pass has no leftover flat trail or ripple blending", () => {
    const post = stripComments(read("post.glsl"));
    expect(post).not.toContain("trail.rgb");
    expect(post).not.toContain("u_rippleTime < 2.0");
    expect(post).toContain("u_resolution.x / u_resolution.y"); // aspect-correct ripple and trail
  });
});
