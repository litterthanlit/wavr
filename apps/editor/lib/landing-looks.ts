// The landing's looks, strongest first; each opens /editor?preset=<id>. The names are the catalogue's
// (PRESET_CATALOG in @wavr/core), written out so the presets' configs stay out of the landing's bundle;
// landing-looks.test.ts keeps them equal.
export const LANDING_LOOKS: readonly { id: string; name: string }[] = [
  { id: "aperture", name: "Aperture" },
  { id: "lightLeak", name: "Light leak" },
  { id: "plasmaOrb", name: "Orb" },
  { id: "lightWall", name: "Light wall" },
];
