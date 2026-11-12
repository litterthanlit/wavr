import type { Rgb } from "./color-stops";

export interface NaturePalette {
  id: string;
  name: string;
  colors: Rgb[];
}

// Palettes taken from landscape photographs: the six main colours of each
// picture, darkest first and lightest last, the order the light looks read.
// They are mostly tinted neutrals with at most one saturated accent, and their
// darks and lights are tinted too, never black or white: that is why they
// blend. Picking one swaps the layer's colours and leaves its look alone.
export const NATURE_PALETTES: NaturePalette[] = [
  { id: "sunsetFog", name: "Sunset over fog", colors: [[0.125, 0.118, 0.137], [0.329, 0.306, 0.333], [0.518, 0.216, 0.22], [0.753, 0.227, 0.227], [0.537, 0.463, 0.475], [0.984, 0.541, 0.439]] },
  { id: "riverSunset", name: "River sunset", colors: [[0.031, 0.051, 0.043], [0.118, 0.129, 0.114], [0.376, 0.286, 0.263], [0.918, 0.4, 0.169], [0.922, 0.573, 0.337], [0.78, 0.714, 0.643]] },
  { id: "pinkFlats", name: "Pink flats", colors: [[0.345, 0.149, 0.078], [0.49, 0.361, 0.431], [0.612, 0.498, 0.62], [0.792, 0.451, 0.365], [0.906, 0.604, 0.686], [0.925, 0.812, 0.855]] },
  { id: "mineral", name: "Mineral", colors: [[0.255, 0.188, 0.235], [0.416, 0.298, 0.322], [0.537, 0.4, 0.439], [0.549, 0.561, 0.722], [0.714, 0.525, 0.565], [0.729, 0.675, 0.761]] },
  { id: "dusk", name: "Dusk", colors: [[0.059, 0.071, 0.055], [0.173, 0.176, 0.129], [0.314, 0.318, 0.329], [0.518, 0.467, 0.529], [0.569, 0.612, 0.694], [0.788, 0.671, 0.686]] },
  { id: "blueHour", name: "Blue hour", colors: [[0.02, 0.043, 0.106], [0.129, 0.157, 0.549], [0.204, 0.227, 0.667], [0.38, 0.365, 0.608], [0.29, 0.341, 0.784], [0.475, 0.514, 0.792]] },
  { id: "cloudSea", name: "Cloud sea", colors: [[0.0, 0.004, 0.012], [0.016, 0.071, 0.09], [0.169, 0.388, 0.545], [0.486, 0.565, 0.667], [0.761, 0.718, 0.714], [0.996, 0.89, 0.694]] },
  { id: "alpine", name: "Alpine", colors: [[0.063, 0.129, 0.169], [0.157, 0.224, 0.243], [0.239, 0.329, 0.404], [0.392, 0.482, 0.588], [0.682, 0.682, 0.741], [0.878, 0.843, 0.843]] },
  { id: "dunes", name: "Dunes", colors: [[0.114, 0.133, 0.18], [0.216, 0.227, 0.259], [0.282, 0.353, 0.447], [0.353, 0.427, 0.533], [0.541, 0.565, 0.612], [0.761, 0.773, 0.792]] },
  { id: "mistCoast", name: "Mist coast", colors: [[0.184, 0.184, 0.169], [0.357, 0.38, 0.353], [0.463, 0.514, 0.49], [0.592, 0.659, 0.651], [0.773, 0.812, 0.851], [0.918, 0.925, 0.933]] },
  { id: "tropicCoast", name: "Tropic coast", colors: [[0.153, 0.208, 0.161], [0.322, 0.329, 0.216], [0.467, 0.447, 0.361], [0.565, 0.553, 0.498], [0.647, 0.757, 0.769], [0.882, 0.843, 0.8]] },
  { id: "desertPool", name: "Desert pool", colors: [[0.141, 0.161, 0.157], [0.376, 0.298, 0.204], [0.361, 0.482, 0.49], [0.663, 0.553, 0.416], [0.478, 0.616, 0.647], [0.843, 0.729, 0.584]] },
  { id: "desertDusk", name: "Desert dusk", colors: [[0.208, 0.161, 0.169], [0.314, 0.271, 0.282], [0.412, 0.376, 0.384], [0.525, 0.557, 0.631], [0.635, 0.655, 0.698], [0.761, 0.733, 0.722]] },
  { id: "forest", name: "Forest light", colors: [[0.016, 0.016, 0.008], [0.047, 0.055, 0.027], [0.094, 0.11, 0.059], [0.188, 0.188, 0.129], [0.42, 0.353, 0.231], [0.816, 0.741, 0.62]] },
];

/** The palette as a CSS gradient, for its swatch. */
export function paletteSwatch(colors: readonly Rgb[]): string {
  const stops = colors.map(([r, g, b]) => `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`);
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
