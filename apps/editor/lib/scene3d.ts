export type SceneObjectKind = "sphere" | "torus" | "plane" | "box" | "cylinder";

export type Vec3 = [number, number, number];

export interface SceneObject3D {
  id: string;
  name: string;
  kind: SceneObjectKind;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
  metalness: number;
  roughness: number;
  opacity: number;
  wireframe: boolean;
  motionSpeed: number;
  floatAmplitude: number;
}

export interface ParticleField {
  id: string;
  name: string;
  count: number;
  spread: number;
  size: number;
  color: string;
  opacity: number;
  speed: number;
  depth: number;
  mouseReact: number;
}

export interface Scene3DState {
  selectedObjectId: string | null;
  camera: {
    position: Vec3;
    fov: number;
  };
  lights: {
    ambient: number;
    directional: number;
  };
  objects: SceneObject3D[];
  particles: ParticleField[];
  quality: {
    dpr: number;
    maxFps: number;
  };
  interaction: {
    mouseReact: number;
  };
}

const KIND_LABELS: Record<SceneObjectKind, string> = {
  sphere: "Sphere",
  torus: "Torus",
  plane: "Plane",
  box: "Box",
  cylinder: "Cylinder",
};

export function createSceneObject(kind: SceneObjectKind, index = 0): SceneObject3D {
  const offset = (index % 3) - 1;
  return {
    id: `obj-${Date.now()}-${index}`,
    name: `${KIND_LABELS[kind]} ${index + 1}`,
    kind,
    position: [offset * 1.1, 0, -0.25],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: "#f8fafc",
    metalness: 0.55,
    roughness: 0.22,
    opacity: 0.92,
    wireframe: false,
    motionSpeed: 0.35,
    floatAmplitude: 0.22,
  };
}

export function createParticleField(index = 0): ParticleField {
  return {
    id: `particles-${Date.now()}-${index}`,
    name: `Particle Field ${index + 1}`,
    count: 240,
    spread: 5,
    size: 0.025,
    color: "#ffffff",
    opacity: 0.58,
    speed: 0.22,
    depth: 1.6,
    mouseReact: 0.35,
  };
}

export const DEFAULT_SCENE_3D_STATE: Scene3DState = {
  selectedObjectId: "obj-default-sphere",
  camera: {
    position: [0, 0.1, 5],
    fov: 42,
  },
  lights: {
    ambient: 0.85,
    directional: 1.1,
  },
  objects: [
    {
      ...createSceneObject("sphere", 0),
      id: "obj-default-sphere",
      name: "Hero Orb",
      position: [0, 0, 0],
      scale: [1.25, 1.25, 1.25],
      color: "#e5e7eb",
    },
  ],
  particles: [
    {
      ...createParticleField(0),
      id: "particles-default-field",
      name: "Depth Dust",
    },
  ],
  quality: {
    dpr: 1.5,
    maxFps: 45,
  },
  interaction: {
    mouseReact: 0.35,
  },
};

export function cloneScene3D(scene: Scene3DState): Scene3DState {
  return {
    selectedObjectId: scene.selectedObjectId,
    camera: {
      position: [...scene.camera.position] as Vec3,
      fov: scene.camera.fov,
    },
    lights: { ...scene.lights },
    objects: scene.objects.map((object) => ({
      ...object,
      position: [...object.position] as Vec3,
      rotation: [...object.rotation] as Vec3,
      scale: [...object.scale] as Vec3,
    })),
    particles: scene.particles.map((field) => ({ ...field })),
    quality: { ...scene.quality },
    interaction: { ...scene.interaction },
  };
}
