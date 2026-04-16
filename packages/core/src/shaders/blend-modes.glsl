// ============================================================
// Photoshop Blend Modes (all 27)
// Requires: hsl.glsl (rgbToHsl, hslToRgb)
// ============================================================

// --- Normal ---
vec3 blendNormal(vec3 base, vec3 blend) {
  return blend;
}

// --- Darken Group ---
vec3 blendDarken(vec3 base, vec3 blend) {
  return min(base, blend);
}

vec3 blendMultiply(vec3 base, vec3 blend) {
  return base * blend;
}

vec3 blendColorBurn(vec3 base, vec3 blend) {
  return mix(
    vec3(0.0),
    1.0 - min(vec3(1.0), (1.0 - base) / max(blend, vec3(0.001))),
    step(vec3(0.001), blend)
  );
}

vec3 blendLinearBurn(vec3 base, vec3 blend) {
  return max(base + blend - 1.0, 0.0);
}

vec3 blendDarkerColor(vec3 base, vec3 blend) {
  float baseLum = dot(base, vec3(0.299, 0.587, 0.114));
  float blendLum = dot(blend, vec3(0.299, 0.587, 0.114));
  return (blendLum < baseLum) ? blend : base;
}

// --- Lighten Group ---
vec3 blendLighten(vec3 base, vec3 blend) {
  return max(base, blend);
}

vec3 blendScreen(vec3 base, vec3 blend) {
  return 1.0 - (1.0 - base) * (1.0 - blend);
}

vec3 blendColorDodge(vec3 base, vec3 blend) {
  return mix(
    min(base / max(1.0 - blend, vec3(0.001)), vec3(1.0)),
    vec3(1.0),
    step(vec3(1.0), blend)
  );
}

vec3 blendLinearDodge(vec3 base, vec3 blend) {
  return min(base + blend, 1.0);
}

vec3 blendLighterColor(vec3 base, vec3 blend) {
  float baseLum = dot(base, vec3(0.299, 0.587, 0.114));
  float blendLum = dot(blend, vec3(0.299, 0.587, 0.114));
  return (blendLum > baseLum) ? blend : base;
}

// --- Contrast Group ---
vec3 blendOverlay(vec3 base, vec3 blend) {
  return mix(
    2.0 * base * blend,
    1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
    step(0.5, base)
  );
}

vec3 blendSoftLight(vec3 base, vec3 blend) {
  return mix(
    2.0 * base * blend + base * base * (1.0 - 2.0 * blend),
    sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend),
    step(0.5, blend)
  );
}

vec3 blendHardLight(vec3 base, vec3 blend) {
  return mix(
    2.0 * base * blend,
    1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
    step(0.5, blend)
  );
}

vec3 blendVividLight(vec3 base, vec3 blend) {
  vec3 burn = 1.0 - min(vec3(1.0), (1.0 - base) / max(2.0 * blend, vec3(0.001)));
  vec3 dodge = min(base / max(2.0 * (1.0 - blend), vec3(0.001)), vec3(1.0));
  return mix(burn, dodge, step(0.5, blend));
}

vec3 blendLinearLight(vec3 base, vec3 blend) {
  return clamp(base + 2.0 * blend - 1.0, 0.0, 1.0);
}

vec3 blendPinLight(vec3 base, vec3 blend) {
  vec3 dark = min(base, 2.0 * blend);
  vec3 light = max(base, 2.0 * blend - 1.0);
  return mix(dark, light, step(0.5, blend));
}

vec3 blendHardMix(vec3 base, vec3 blend) {
  return step(1.0, base + blend);
}

// --- Inversion Group ---
vec3 blendDifference(vec3 base, vec3 blend) {
  return abs(base - blend);
}

vec3 blendExclusion(vec3 base, vec3 blend) {
  return base + blend - 2.0 * base * blend;
}

vec3 blendSubtract(vec3 base, vec3 blend) {
  return max(base - blend, 0.0);
}

vec3 blendDivide(vec3 base, vec3 blend) {
  return min(base / max(blend, vec3(0.001)), vec3(1.0));
}

// --- Component Group (HSL-based) ---
vec3 blendHue(vec3 base, vec3 blend) {
  vec3 baseHSL = rgbToHsl(base);
  vec3 blendHSL = rgbToHsl(blend);
  return hslToRgb(vec3(blendHSL.x, baseHSL.y, baseHSL.z));
}

vec3 blendSaturation(vec3 base, vec3 blend) {
  vec3 baseHSL = rgbToHsl(base);
  vec3 blendHSL = rgbToHsl(blend);
  return hslToRgb(vec3(baseHSL.x, blendHSL.y, baseHSL.z));
}

vec3 blendColor(vec3 base, vec3 blend) {
  vec3 baseHSL = rgbToHsl(base);
  vec3 blendHSL = rgbToHsl(blend);
  return hslToRgb(vec3(blendHSL.x, blendHSL.y, baseHSL.z));
}

vec3 blendLuminosity(vec3 base, vec3 blend) {
  vec3 baseHSL = rgbToHsl(base);
  vec3 blendHSL = rgbToHsl(blend);
  return hslToRgb(vec3(baseHSL.x, baseHSL.y, blendHSL.z));
}

// ============================================================
// Blend Mode Dispatch
// ============================================================

vec3 dispatchBlend(vec3 base, vec3 blend, int mode) {
  if (mode == 0) return blendNormal(base, blend);
  else if (mode == 1) return blendMultiply(base, blend);
  else if (mode == 2) return blendScreen(base, blend);
  else if (mode == 3) return blendOverlay(base, blend);
  else if (mode == 4) return blendLinearDodge(base, blend); // Add
  else if (mode == 5) return blendDarken(base, blend);
  else if (mode == 6) return blendColorBurn(base, blend);
  else if (mode == 7) return blendLinearBurn(base, blend);
  else if (mode == 8) return blendDarkerColor(base, blend);
  else if (mode == 9) return blendLighten(base, blend);
  else if (mode == 10) return blendColorDodge(base, blend);
  else if (mode == 11) return blendLighterColor(base, blend);
  else if (mode == 12) return blendSoftLight(base, blend);
  else if (mode == 13) return blendHardLight(base, blend);
  else if (mode == 14) return blendVividLight(base, blend);
  else if (mode == 15) return blendLinearLight(base, blend);
  else if (mode == 16) return blendPinLight(base, blend);
  else if (mode == 17) return blendHardMix(base, blend);
  else if (mode == 18) return blendDifference(base, blend);
  else if (mode == 19) return blendExclusion(base, blend);
  else if (mode == 20) return blendSubtract(base, blend);
  else if (mode == 21) return blendDivide(base, blend);
  else if (mode == 22) return blendHue(base, blend);
  else if (mode == 23) return blendSaturation(base, blend);
  else if (mode == 24) return blendColor(base, blend);
  else if (mode == 25) return blendLuminosity(base, blend);
  return blend;
}
