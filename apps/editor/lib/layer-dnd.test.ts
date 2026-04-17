import { describe, it, expect, beforeEach } from "vitest";
import { createLayer } from "@wavr/core";
import { useGradientStore } from "./store";
import {
  computeMoveFromDragEnd,
  layerIdFor,
  parseLayerId,
} from "./layer-dnd";

function setupThreeLayerStore() {
  const layers = [
    createLayer({ gradientType: "plasma", complexity: 3 }),
    createLayer({ gradientType: "mesh", complexity: 5 }),
    createLayer({ gradientType: "radial", complexity: 2 }),
  ];
  // Stamp a uniquely identifying marker on each layer so we can trace them
  // through the reorder regardless of their type/complexity defaults.
  const tagged = layers.map((l, i) => ({
    ...l,
    scale: 1 + i * 0.1,
  }));
  useGradientStore.setState({ layers: tagged, activeLayerIndex: 0 });
  return tagged;
}

describe("layer-dnd helpers", () => {
  describe("layerIdFor / parseLayerId", () => {
    it("round-trips indices", () => {
      for (const i of [0, 1, 2, 3]) {
        expect(parseLayerId(layerIdFor(i))).toBe(i);
      }
    });

    it("returns null for ids missing the prefix", () => {
      expect(parseLayerId("effect-1")).toBeNull();
      expect(parseLayerId("layer-")).toBeNull();
      expect(parseLayerId("layer-abc")).toBeNull();
      expect(parseLayerId("layer--1")).toBeNull();
    });
  });

  describe("computeMoveFromDragEnd", () => {
    it("returns [from, to] for a valid drag", () => {
      const result = computeMoveFromDragEnd(
        { active: { id: "layer-0" }, over: { id: "layer-2" } },
        3,
      );
      expect(result).toEqual([0, 2]);
    });

    it("returns null when over is null (drag released outside)", () => {
      const result = computeMoveFromDragEnd(
        { active: { id: "layer-0" }, over: null },
        3,
      );
      expect(result).toBeNull();
    });

    it("returns null for a drag onto itself", () => {
      const result = computeMoveFromDragEnd(
        { active: { id: "layer-1" }, over: { id: "layer-1" } },
        3,
      );
      expect(result).toBeNull();
    });

    it("returns null for unrecognized ids", () => {
      expect(
        computeMoveFromDragEnd(
          { active: { id: "foo" }, over: { id: "layer-1" } },
          3,
        ),
      ).toBeNull();
    });

    it("guards against stale indices past current layer count", () => {
      const result = computeMoveFromDragEnd(
        { active: { id: "layer-0" }, over: { id: "layer-5" } },
        3,
      );
      expect(result).toBeNull();
    });
  });

  describe("end-to-end: drag-end -> store.moveLayer -> reorder", () => {
    beforeEach(() => {
      setupThreeLayerStore();
    });

    it("moves layer 0 to position 2 (drag down)", () => {
      const before = useGradientStore.getState().layers.map((l) => l.gradientType);
      expect(before).toEqual(["plasma", "mesh", "radial"]);

      const move = computeMoveFromDragEnd(
        { active: { id: "layer-0" }, over: { id: "layer-2" } },
        useGradientStore.getState().layers.length,
      );
      expect(move).not.toBeNull();
      const [from, to] = move!;
      useGradientStore.getState().moveLayer(from, to);

      const after = useGradientStore.getState().layers.map((l) => l.gradientType);
      expect(after).toEqual(["mesh", "radial", "plasma"]);
    });

    it("moves layer 2 to position 0 (drag up)", () => {
      const move = computeMoveFromDragEnd(
        { active: { id: "layer-2" }, over: { id: "layer-0" } },
        useGradientStore.getState().layers.length,
      );
      expect(move).not.toBeNull();
      const [from, to] = move!;
      useGradientStore.getState().moveLayer(from, to);

      const after = useGradientStore.getState().layers.map((l) => l.gradientType);
      expect(after).toEqual(["radial", "plasma", "mesh"]);
    });

    it("active-layer highlight follows the dragged layer through a reorder", () => {
      // Select middle layer, then drag it to the end.
      useGradientStore.setState({ activeLayerIndex: 1 });

      const move = computeMoveFromDragEnd(
        { active: { id: "layer-1" }, over: { id: "layer-2" } },
        useGradientStore.getState().layers.length,
      );
      const [from, to] = move!;
      useGradientStore.getState().moveLayer(from, to);

      const state = useGradientStore.getState();
      expect(state.activeLayerIndex).toBe(2);
      expect(state.layers[2].gradientType).toBe("mesh");
    });

    it("undo restores the pre-reorder layer order", () => {
      const initialOrder = useGradientStore
        .getState()
        .layers.map((l) => l.gradientType);

      const move = computeMoveFromDragEnd(
        { active: { id: "layer-0" }, over: { id: "layer-1" } },
        useGradientStore.getState().layers.length,
      );
      const [from, to] = move!;
      useGradientStore.getState().moveLayer(from, to);

      expect(
        useGradientStore.getState().layers.map((l) => l.gradientType),
      ).toEqual(["mesh", "plasma", "radial"]);

      useGradientStore.getState().undo();

      expect(
        useGradientStore.getState().layers.map((l) => l.gradientType),
      ).toEqual(initialOrder);
    });
  });
});
