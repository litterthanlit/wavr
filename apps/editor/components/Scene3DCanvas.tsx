"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas as R3FCanvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getEditorPerformanceSettings, useGradientStore } from "@/lib/store";
import type { ParticleField, Scene3DState, SceneObject3D } from "@/lib/scene3d";

interface Scene3DCanvasProps {
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

type ScenePointer = { x: number; y: number };

function SceneRenderLoop({ enabled, playing, maxFps }: { enabled: boolean; playing: boolean; maxFps: number }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (!enabled || !playing) return;
    let raf = 0;
    let last = 0;
    const minFrameMs = 1000 / Math.max(24, Math.min(60, maxFps));

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.visibilityState === "hidden") return;
      if (now - last < minFrameMs) return;
      last = now;
      invalidate();
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled, invalidate, maxFps, playing]);

  return null;
}

function SceneInvalidator({ enabled, scene }: { enabled: boolean; scene: Scene3DState }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (enabled) invalidate();
  }, [enabled, invalidate, scene]);

  return null;
}

function ScenePrimitive({
  object,
  mouseReact,
  pointerRef,
}: {
  object: SceneObject3D;
  mouseReact: number;
  pointerRef: MutableRefObject<ScenePointer>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const time = clock.elapsedTime;
    const pointer = pointerRef.current;
    mesh.rotation.x = object.rotation[0] + time * object.motionSpeed * 0.35;
    mesh.rotation.y = object.rotation[1] + time * object.motionSpeed;
    mesh.rotation.z = object.rotation[2];
    mesh.position.x = object.position[0] + pointer.x * mouseReact * 0.35;
    mesh.position.y = object.position[1] + Math.sin(time * 1.2 + object.position[0]) * object.floatAmplitude + pointer.y * mouseReact * 0.25;
    mesh.position.z = object.position[2];
  });

  return (
    <mesh ref={meshRef} position={object.position} scale={object.scale}>
      {object.kind === "sphere" && <sphereGeometry args={[1, 64, 32]} />}
      {object.kind === "torus" && <torusGeometry args={[0.82, 0.24, 32, 96]} />}
      {object.kind === "plane" && <planeGeometry args={[2, 2, 48, 48]} />}
      {object.kind === "box" && <boxGeometry args={[1.5, 1.5, 1.5, 18, 18, 18]} />}
      {object.kind === "cylinder" && <cylinderGeometry args={[0.75, 0.75, 1.6, 48, 12]} />}
      <meshStandardMaterial
        color={object.color}
        metalness={object.metalness}
        roughness={object.roughness}
        transparent={object.opacity < 1}
        opacity={object.opacity}
        wireframe={object.wireframe}
      />
    </mesh>
  );
}

function ParticleFieldView({
  field,
  pointerRef,
  particleScale,
}: {
  field: ParticleField;
  pointerRef: MutableRefObject<ScenePointer>;
  particleScale: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = Math.max(40, Math.round(field.count * particleScale));
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const r = Math.sqrt((i * 16807) % 997 / 997);
      const theta = (i * 2.399963 + field.depth) % (Math.PI * 2);
      values[ix] = Math.cos(theta) * r * field.spread;
      values[ix + 1] = Math.sin(theta) * r * field.spread * 0.55;
      values[ix + 2] = ((i % 41) / 40 - 0.5) * field.depth * 2;
    }
    return values;
  }, [count, field.depth, field.spread]);

  useFrame(({ clock }) => {
    const points = pointsRef.current;
    if (!points) return;
    const pointer = pointerRef.current;
    points.rotation.y = clock.elapsedTime * field.speed * 0.12;
    points.rotation.z = Math.sin(clock.elapsedTime * field.speed * 0.4) * 0.08;
    points.position.x = pointer.x * field.mouseReact * 0.5;
    points.position.y = pointer.y * field.mouseReact * 0.35;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={field.color}
        size={field.size}
        transparent
        opacity={field.opacity}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function SceneContents({
  scene,
  pointerRef,
  particleScale,
}: {
  scene: Scene3DState;
  pointerRef: MutableRefObject<ScenePointer>;
  particleScale: number;
}) {
  return (
    <>
      <ambientLight intensity={scene.lights.ambient} />
      <directionalLight position={[3, 4, 5]} intensity={scene.lights.directional} />
      <group>
        {scene.objects.map((object) => (
          <ScenePrimitive key={object.id} object={object} mouseReact={scene.interaction.mouseReact} pointerRef={pointerRef} />
        ))}
        {scene.particles.map((field) => (
          <ParticleFieldView key={field.id} field={field} pointerRef={pointerRef} particleScale={particleScale} />
        ))}
      </group>
    </>
  );
}

export default function Scene3DCanvas({ onCanvasReady }: Scene3DCanvasProps) {
  const enabled = useGradientStore((state) => state.scene3DEnabled);
  const scene = useGradientStore((state) => state.scene3D);
  const playing = useGradientStore((state) => state.playing);
  const performanceMode = useGradientStore((state) => state.performanceMode);
  const performance = getEditorPerformanceSettings(performanceMode);
  const effectiveDpr = performanceMode === "quality"
    ? performance.sceneDprCap
    : Math.min(performance.sceneDprCap, scene.quality.dpr);
  const effectiveMaxFps = performanceMode === "quality"
    ? performance.sceneMaxFps
    : Math.min(performance.sceneMaxFps, scene.quality.maxFps);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<ScenePointer>({ x: 0, y: 0 });

  useEffect(() => () => onCanvasReady?.(null), [onCanvasReady]);

  useEffect(() => {
    if (!enabled) onCanvasReady?.(null);
  }, [enabled, onCanvasReady]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      const left = rect?.left ?? 0;
      const top = rect?.top ?? 0;
      const width = rect?.width ?? window.innerWidth;
      const height = rect?.height ?? window.innerHeight;
      if (width <= 0 || height <= 0) return;
      pointerRef.current.x = ((event.clientX - left) / width) * 2 - 1;
      pointerRef.current.y = -(((event.clientY - top) / height) * 2 - 1);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  if (!enabled) return null;

  return (
    <div ref={wrapperRef} className="absolute inset-0 pointer-events-none" aria-hidden="true" data-scene3d-overlay>
      <R3FCanvas
        frameloop="demand"
        dpr={[1, effectiveDpr]}
        camera={{ position: scene.camera.position, fov: scene.camera.fov }}
        gl={{
          alpha: true,
          antialias: false,
          powerPreference: performance.powerPreference,
          preserveDrawingBuffer: true,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          onCanvasReady?.(gl.domElement);
        }}
      >
        <SceneInvalidator enabled={enabled} scene={scene} />
        <SceneRenderLoop enabled={enabled} playing={playing} maxFps={effectiveMaxFps} />
        <SceneContents scene={scene} pointerRef={pointerRef} particleScale={performance.particleScale} />
      </R3FCanvas>
    </div>
  );
}
