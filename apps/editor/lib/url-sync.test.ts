import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_CONFIG, GradientConfig, MAX_URL_BYTES, encodeUrl } from "@wavr/schema";
import { createLayer } from "@wavr/core";
import {
  applyHashToStore,
  storeToConfig,
  configToStorePatch,
  __resetUrlSyncForTests,
} from "./url-sync";
import { useGradientStore, type GradientState } from "./store";
import { INITIAL_LAYER_PARAMS } from "./initial-scene";
import { DEFAULT_SCENE_3D_STATE, cloneScene3D } from "./scene3d";

// Build a realistic store state on top of the live store defaults. We mutate
// values that round-tripping should preserve: 2 layers, three effect groups
// enabled with non-default params, shape3d enabled, oklabEnabled flipped.
function buildRealisticState(): GradientState {
  const base = useGradientStore.getState();
  const layerA = createLayer({
    gradientType: "silk",
    speed: 0.8,
    complexity: 5,
    scale: 1.4,
    distortion: 0.6,
    softness: 0.72,
    opacity: 0.9,
    blendMode: "screen",
    depth: 0.25,
    colors: [
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
      [0.9, 0.1, 0.5],
    ],
  });
  const layerB = createLayer({
    gradientType: "conic",
    speed: 0.3,
    complexity: 2,
    scale: 0.9,
    distortion: 0.1,
    softness: 0.2,
    opacity: 0.5,
    blendMode: "multiply",
    depth: -0.1,
    colors: [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
    ],
  });

  return {
    ...base,
    layers: [layerA, layerB],
    activeLayerIndex: 0,
    brightness: 1.25,
    saturation: 0.8,
    grain: 0.15,
    vignette: 0.3,
    chromaticAberration: 0.05,
    hueShift: 45,
    domainWarp: 0.22,
    radialBlurAmount: 0.18,
    mouseReact: 0.75,
    oklabEnabled: false,
    toneMapMode: 2,

    // 3 effect groups enabled with off-default params
    noiseEnabled: true,
    noiseIntensity: 0.55,
    noiseScale: 2.5,
    bloomEnabled: true,
    bloomIntensity: 0.75,
    glowEnabled: true,
    glowIntensity: 0.4,
    glowRadius: 0.12,

    // shape3d
    threeDEnabled: true,
    threeDShape: 2, // plane
    threeDPerspective: 2.0,
    threeDRotationSpeed: 0.6,
    threeDZoom: 1.2,
    threeDLighting: 0.8,

    // Deband (spec 0004): flip enabled off + bump strength so round-trip
    // can't accidentally pass by matching the store defaults.
    debandEnabled: false,
    debandStrength: 1.5,
  };
}

describe("storeToConfig / configToStorePatch", () => {
  beforeEach(() => {
    __resetUrlSyncForTests();
  });

  it("storeToConfig → configToStorePatch round-trips a realistic state", () => {
    const state = buildRealisticState();
    const config = storeToConfig(state);

    // The config must parse clean.
    const parsed = GradientConfig.safeParse(config);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const patch = configToStorePatch(parsed.data);

    // Scalar globals survive exactly.
    expect(patch.brightness).toBe(state.brightness);
    expect(patch.saturation).toBe(state.saturation);
    expect(patch.grain).toBe(state.grain);
    expect(patch.vignette).toBe(state.vignette);
    expect(patch.chromaticAberration).toBe(state.chromaticAberration);
    expect(patch.hueShift).toBe(state.hueShift);
    expect(patch.domainWarp).toBe(state.domainWarp);
    expect(patch.radialBlurAmount).toBe(state.radialBlurAmount);
    expect(patch.mouseReact).toBe(state.mouseReact);
    expect(patch.oklabEnabled).toBe(state.oklabEnabled);
    expect(patch.toneMapMode).toBe(state.toneMapMode);

    // Three enabled effect groups survive.
    expect(patch.noiseEnabled).toBe(true);
    expect(patch.noiseIntensity).toBeCloseTo(0.55);
    expect(patch.noiseScale).toBeCloseTo(2.5);
    expect(patch.bloomEnabled).toBe(true);
    expect(patch.bloomIntensity).toBeCloseTo(0.75);
    expect(patch.glowEnabled).toBe(true);
    expect(patch.glowIntensity).toBeCloseTo(0.4);
    expect(patch.glowRadius).toBeCloseTo(0.12);

    // shape3d converts number → enum → number.
    expect(patch.threeDEnabled).toBe(true);
    expect(patch.threeDShape).toBe(2); // "plane" → 2
    expect(patch.threeDPerspective).toBeCloseTo(2.0);
    expect(patch.threeDRotationSpeed).toBeCloseTo(0.6);
    expect(patch.threeDZoom).toBeCloseTo(1.2);
    expect(patch.threeDLighting).toBeCloseTo(0.8);

    // Deband (spec 0004): round-trips enabled flag + strength.
    expect(patch.debandEnabled).toBe(false);
    expect(patch.debandStrength).toBeCloseTo(1.5);

    // Layers: both layers' 9 schema-owned fields round-trip.
    expect(patch.layers).toBeDefined();
    const outLayers = patch.layers!;
    expect(outLayers.length).toBe(2);
    expect(outLayers[0].gradientType).toBe("silk");
    expect(outLayers[0].speed).toBeCloseTo(0.8);
    expect(outLayers[0].complexity).toBe(5);
    expect(outLayers[0].scale).toBeCloseTo(1.4);
    expect(outLayers[0].distortion).toBeCloseTo(0.6);
    expect(outLayers[0].softness).toBeCloseTo(0.72);
    expect(outLayers[0].opacity).toBeCloseTo(0.9);
    expect(outLayers[0].blendMode).toBe("screen");
    expect(outLayers[0].depth).toBeCloseTo(0.25);
    expect(outLayers[0].colors.length).toBe(3);

    expect(outLayers[1].gradientType).toBe("conic");
    expect(outLayers[1].softness).toBeCloseTo(0.2);
    expect(outLayers[1].blendMode).toBe("multiply");
    expect(outLayers[1].opacity).toBeCloseTo(0.5);
    expect(outLayers[1].colors.length).toBe(2);

    // Layer-extension fields get schema defaults back (visible=true, etc).
    expect(outLayers[0].visible).toBe(true);
    expect(outLayers[0].imageData).toBeNull();
    expect(outLayers[0].maskEnabled).toBe(false);
  });

  it("configToStorePatch(DEFAULT_CONFIG) matches store defaults for schema-owned fields", () => {
    const patch = configToStorePatch(DEFAULT_CONFIG);
    const defaults = useGradientStore.getState();

    // Only fields that are in both buckets should match. `brightness` etc
    // default to 1 in both; radialBlur default is 0 in both.
    expect(patch.brightness).toBe(defaults.brightness);
    expect(patch.saturation).toBe(defaults.saturation);
    expect(patch.grain).toBe(defaults.grain);
    expect(patch.vignette).toBe(defaults.vignette);
    expect(patch.chromaticAberration).toBe(defaults.chromaticAberration);
    expect(patch.hueShift).toBe(defaults.hueShift);
    expect(patch.domainWarp).toBe(defaults.domainWarp);
    expect(patch.radialBlurAmount).toBe(defaults.radialBlurAmount);
    expect(patch.mouseReact).toBe(defaults.mouseReact);
    expect(patch.oklabEnabled).toBe(defaults.oklabEnabled);
    expect(patch.toneMapMode).toBe(defaults.toneMapMode);

    // DEFAULT_CONFIG has no effect groups set, so the patch omits triples
    // rather than overwriting the store's existing values.
    expect(patch.noiseEnabled).toBeUndefined();
    expect(patch.bloomEnabled).toBeUndefined();
    expect(patch.threeDEnabled).toBeUndefined();
  });

  it("shape3d string → number mapping covers all five kinds", () => {
    const kinds = ["sphere", "torus", "plane", "cylinder", "cube"] as const;
    for (let i = 0; i < kinds.length; i++) {
      const config: GradientConfig = {
        ...DEFAULT_CONFIG,
        shape3d: {
          enabled: true,
          shape: kinds[i],
          perspective: 1.5,
          rotationSpeed: 0.3,
          zoom: 1,
          lighting: 0.5,
        },
      };
      const patch = configToStorePatch(config);
      expect(patch.threeDShape).toBe(i);
    }
  });

  it("omits editor-only Three scene state from URL config", () => {
    const scene3D = cloneScene3D(DEFAULT_SCENE_3D_STATE);
    scene3D.camera.fov = 55;
    scene3D.objects = scene3D.objects.map((object) => ({
      ...object,
      kind: "torus",
    }));

    const config = storeToConfig({
      ...buildRealisticState(),
      scene3DEnabled: true,
      scene3D,
    });
    const rawConfig = config as Record<string, unknown>;

    expect(rawConfig.scene3DEnabled).toBeUndefined();
    expect(rawConfig.scene3D).toBeUndefined();

    const patch = configToStorePatch(config);
    expect(patch.scene3DEnabled).toBeUndefined();
    expect(patch.scene3D).toBeUndefined();
  });
});

describe("oversized config guard", () => {
  const originalWindow = (globalThis as { window?: Window }).window;
  const originalHistory = (globalThis as { history?: History }).history;

  beforeEach(() => {
    __resetUrlSyncForTests();
  });

  afterEach(() => {
    // Restore any globals we stubbed.
    if (originalWindow !== undefined) {
      (globalThis as unknown as { window: Window }).window = originalWindow;
    } else {
      delete (globalThis as { window?: Window }).window;
    }
    if (originalHistory !== undefined) {
      (globalThis as unknown as { history: History }).history = originalHistory;
    } else {
      delete (globalThis as { history?: History }).history;
    }
    vi.restoreAllMocks();
  });

  it("skips the write and warns once when encodeUrl yields >MAX_URL_BYTES", async () => {
    const huge = "s2." + "a".repeat(MAX_URL_BYTES + 500);

    // Set up a minimal window/history shim so writeNow can touch replaceState.
    const replaceState = vi.fn();
    const pushState = vi.fn();
    (globalThis as unknown as { window: Partial<Window> }).window = {
      location: { hash: "" } as Location,
      history: { replaceState, pushState } as unknown as History,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window;

    // Hoist the mock BEFORE importing url-sync.
    vi.resetModules();
    vi.doMock("@wavr/schema", async () => {
      const actual = await vi.importActual("@wavr/schema");
      return {
        ...(actual as object),
        encodeUrl: () => huge,
      };
    });

    const mod = await import("./url-sync");
    const store = await import("./store");
    mod.__resetUrlSyncForTests();

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    mod.initializeUrlSync();
    // Trigger the subscriber via a store change, then flush the debounce.
    store.useGradientStore.setState({ brightness: 1.42 });
    await mod.__flushForTests();

    // replaceState must NOT have been called — oversize write was skipped.
    expect(replaceState).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    const firstArg = warn.mock.calls[0]?.[0];
    expect(typeof firstArg === "string" ? firstArg : "").toMatch(
      /MAX_URL_BYTES|exceeds|preset/,
    );

    // A second oversize attempt should not warn again (one-time guard).
    store.useGradientStore.setState({ brightness: 1.43 });
    await mod.__flushForTests();
    expect(warn).toHaveBeenCalledTimes(1);

    vi.doUnmock("@wavr/schema");
  });
});

describe("lazy URL codec", () => {
  const originalWindow = (globalThis as { window?: Window }).window;

  function stubWindow(hash: string) {
    const replaceState = vi.fn();
    const pushState = vi.fn();
    (globalThis as unknown as { window: Partial<Window> }).window = {
      location: { hash, href: `http://localhost/editor${hash}` } as Location,
      history: { replaceState, pushState } as unknown as History,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window;
    return { replaceState, pushState };
  }

  // Fresh module instances, so the codec cache starts empty in every test.
  async function freshModules() {
    vi.resetModules();
    const sync = await import("./url-sync");
    const { useGradientStore: store } = await import("./store");
    sync.__resetUrlSyncForTests();
    return { sync, store };
  }

  afterEach(() => {
    if (originalWindow !== undefined) {
      (globalThis as unknown as { window: Window }).window = originalWindow;
    } else {
      delete (globalThis as { window?: Window }).window;
    }
    vi.restoreAllMocks();
  });

  it("applies an empty hash synchronously without loading the codec", async () => {
    stubWindow("");
    const { sync, store } = await freshModules();
    store.setState({ brightness: 1.7 });

    const pending = sync.applyHashToStore();

    // Reset happened before anything was awaited.
    expect(store.getState().brightness).toBe(DEFAULT_CONFIG.brightness);
    expect(sync.isUrlCodecLoaded()).toBe(false);
    await pending;
    expect(sync.isUrlCodecLoaded()).toBe(false);
  });

  it("waits for the codec to load before applying a shared hash", async () => {
    const config = GradientConfig.parse({ ...DEFAULT_CONFIG, brightness: 1.42 });
    stubWindow(`#${encodeUrl(config)}`);
    const { sync, store } = await freshModules();
    expect(sync.isUrlCodecLoaded()).toBe(false);

    await sync.applyHashToStore();

    expect(sync.isUrlCodecLoaded()).toBe(true);
    expect(store.getState().brightness).toBeCloseTo(1.42);
  });

  it("applies a shared hash synchronously once the codec is loaded", async () => {
    const config = GradientConfig.parse({ ...DEFAULT_CONFIG, saturation: 0.6 });
    stubWindow(`#${encodeUrl(config)}`);
    const { sync, store } = await freshModules();
    await sync.loadUrlCodec();

    void sync.applyHashToStore();

    expect(store.getState().saturation).toBeCloseTo(0.6);
  });

  it("writes the URL after the codec loads, via replaceState", async () => {
    const { replaceState } = stubWindow("");
    const { sync, store } = await freshModules();
    sync.initializeUrlSync();
    expect(sync.isUrlCodecLoaded()).toBe(false);

    store.setState({ brightness: 1.31 });
    await sync.__flushForTests();

    expect(sync.isUrlCodecLoaded()).toBe(true);
    expect(replaceState).toHaveBeenCalledTimes(1);
    const hash = replaceState.mock.calls[0]?.[2];
    expect(typeof hash === "string" ? hash : "").toMatch(/^#s2\./);
  });

  it("falls back to the current URL when sharing before the codec is loaded", async () => {
    stubWindow("#s2.abc");
    const { sync, store } = await freshModules();
    vi.spyOn(console, "info").mockImplementation(() => {});

    expect(sync.getShareUrlV2(store.getState())).toBe("http://localhost/editor#s2.abc");

    await sync.loadUrlCodec();
    expect(sync.getShareUrlV2(store.getState())).toMatch(/#s2\./);
  });
});

describe("empty hash", () => {
  const originalWindow = (globalThis as { window?: Window }).window;

  afterEach(() => {
    if (originalWindow !== undefined) {
      (globalThis as unknown as { window: Window }).window = originalWindow;
    } else {
      delete (globalThis as { window?: Window }).window;
    }
  });

  it("opens the editor's initial scene, not the schema baseline", () => {
    (globalThis as unknown as { window: Partial<Window> }).window = {
      location: { hash: "" } as Location,
    } as unknown as Window;
    useGradientStore.setState({ layers: [createLayer({ gradientType: "plasma" })] });

    // An empty hash applies synchronously; there's no codec to wait for.
    void applyHashToStore();

    const [layer] = useGradientStore.getState().layers;
    expect(layer.gradientType).toBe(INITIAL_LAYER_PARAMS.gradientType);
    expect(layer.colors).toEqual(INITIAL_LAYER_PARAMS.colors);
    expect(DEFAULT_CONFIG.layers[0].type).not.toBe(layer.gradientType);
  });

  it("the initial scene is a valid config", () => {
    const config = storeToConfig({
      ...useGradientStore.getState(),
      layers: [createLayer(INITIAL_LAYER_PARAMS)],
    });
    expect(GradientConfig.safeParse(config).success).toBe(true);
  });
});
