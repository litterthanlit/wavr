// ============================================================
// Pointer warp
// ============================================================
// One displacement of the layer's sampling coordinates around the pointer.
// layer.glsl calls mouseWarp() once on the layer's uv, right before the
// gradient is evaluated, so the gradient functions know nothing about the
// pointer. The style comes from the gradient (WAVR_MOUSE_WARP, below).
//
// Engine inputs (GradientEngine.setLayerGlobals):
//   u_mouseSmooth    the pointer, smoothed without overshoot: uv, y up
//   u_mouseVelocity  its velocity in canvas heights per second (aspect-correct)
//   u_mousePresence  0..1: eases in when the pointer enters, out when it leaves
//   u_mouseReact     the user's strength, 0..1
//
// What every style guarantees:
//  - Distances are measured in aspect-correct space (x scaled by width/height,
//    so the unit is the canvas height): the influence is a circle exactly
//    under the pointer at any canvas shape.
//  - It is local. The radius is MOUSE_RADIUS times a per-style factor at full
//    strength, and the falloff (1 - r^2)^2 is C1 and exactly zero beyond it:
//    no tail, no singularity at the centre (nothing is normalised without a
//    smooth ramp).
//  - It is absent with the pointer: everything is scaled by react * presence.
//  - Only the "motion" terms depend on velocity, which is clamped at
//    MOUSE_SPEED_REF. A still pointer gets a gentle static lens, never a spin
//    or a sharp crease.
//  - Strength is calibrated across styles by the peak displacement of the
//    picture at react = 1: about 0.04 canvas heights with the pointer still
//    and 0.08 at MOUSE_SPEED_REF, so react means the same thing for every
//    style. A bulge d = -p k w(r) peaks at 0.286 k R (at r = 0.447 R) and a
//    twist by angle A at 0.286 A R; the k and A below are those peaks divided
//    out. After changing any constant run `node tests/parity/mouse-probe.mjs`,
//    which measures every style.

const float MOUSE_RADIUS = 0.26;      // canvas heights, at react = 1
const float MOUSE_SPEED_REF = 1.5;    // canvas heights per second at which motion terms are at full strength

struct MouseField {
  vec2 p;        // from the pointer to this pixel, canvas heights
  float r;       // |p| / radius: 0 at the pointer, 1 where the influence ends
  float w;       // C1 falloff of r: 1 at the pointer, exactly 0 from r = 1 on
  float amount;  // react * presence
  vec2 motion;   // pointer velocity / MOUSE_SPEED_REF, length <= 1
};

MouseField mouseField(vec2 uv, float radiusScale) {
  MouseField f;
  float react = clamp(u_mouseReact, 0.0, 1.0);
  f.p = (uv - u_mouseSmooth) * vec2(u_resolution.x / u_resolution.y, 1.0);
  // Weaker settings also reach a little less far.
  f.r = length(f.p) / (MOUSE_RADIUS * radiusScale * mix(0.75, 1.0, react));
  float t = max(1.0 - f.r * f.r, 0.0);
  f.w = t * t;
  f.amount = react * clamp(u_mousePresence, 0.0, 1.0);
  // Clamp the length of the velocity without normalising it (it is ~0 at rest).
  float speed = length(u_mouseVelocity);
  f.motion = u_mouseVelocity * (min(speed, MOUSE_SPEED_REF) / (max(speed, 1e-4) * MOUSE_SPEED_REF));
  return f;
}

// An aspect-correct displacement `d` (canvas heights) of the sampling point.
vec2 mouseDisplace(vec2 uv, vec2 d) {
  return uv + d / vec2(u_resolution.x / u_resolution.y, 1.0);
}

// Fluid push: the picture is pushed away from the pointer like a finger in
// water, and dragged along with it when it moves. (Sampling inward is content
// moving outward.)
vec2 mouseWarpPush(vec2 uv) {
  MouseField f = mouseField(uv, 1.0);
  vec2 d = -f.p * (0.54 * f.w) - f.motion * (0.055 * f.w);
  return mouseDisplace(uv, d * f.amount);
}

// Lens: a soft magnifying dome that bends a little around the pointer's
// motion, like light past a heavy object.
vec2 mouseWarpLens(vec2 uv) {
  MouseField f = mouseField(uv, 0.95);
  vec2 bend = vec2(-f.p.y, f.p.x) * (0.50 * length(f.motion));
  vec2 d = -(f.p * 0.57 + bend) * f.w - f.motion * (0.035 * f.w);
  return mouseDisplace(uv, d * f.amount);
}

// Swirl: the picture twists around the pointer, a little at rest and more as
// it moves. The rotation about the centre has no singularity.
vec2 mouseWarpSwirl(vec2 uv) {
  MouseField f = mouseField(uv, 1.15);
  float angle = f.amount * f.w * (0.46 + 0.46 * length(f.motion));
  float c = cos(angle);
  float s = sin(angle);
  vec2 turned = vec2(c * f.p.x + s * f.p.y, c * f.p.y - s * f.p.x);
  return mouseDisplace(uv, turned - f.p);
}

// Wave: rings run outwards from the pointer while it moves (their size follows
// its speed), over a faint static lens. The ring direction fades to zero at the
// centre instead of being normalised there.
vec2 mouseWarpWave(vec2 uv) {
  MouseField f = mouseField(uv, 1.25);
  float len = length(f.p);
  vec2 outward = f.p / sqrt(len * len + 0.0016);
  float rings = sin(len * 46.0 - u_time * 6.0);
  vec2 d = -f.p * (0.38 * f.w) + outward * (rings * f.w * length(f.motion) * 0.070);
  return mouseDisplace(uv, d * f.amount);
}

// Style per gradient (ids: GRADIENT_TYPE_IDS in engine.ts). A new gradient mode
// needs a line here.
#if defined(WAVR_CUSTOM)
#define WAVR_MOUSE_WARP mouseWarpLens
#elif WAVR_GRADIENT == 8
#define WAVR_MOUSE_WARP mouseWarpPush
#elif WAVR_GRADIENT == 17
#define WAVR_MOUSE_WARP mouseWarpSwirl
#elif WAVR_GRADIENT == 18
#define WAVR_MOUSE_WARP mouseWarpWave
#elif WAVR_GRADIENT == 19
#define WAVR_MOUSE_WARP mouseWarpLens
#elif WAVR_GRADIENT == 20
#define WAVR_MOUSE_WARP mouseWarpPush
#elif WAVR_GRADIENT == 21
#define WAVR_MOUSE_WARP mouseWarpSwirl
#elif WAVR_GRADIENT == 22
#define WAVR_MOUSE_WARP mouseWarpLens
#elif WAVR_GRADIENT == 23
#define WAVR_MOUSE_WARP mouseWarpLens
#elif WAVR_GRADIENT == 24
#define WAVR_MOUSE_WARP mouseWarpSwirl
#elif WAVR_GRADIENT == 25
#define WAVR_MOUSE_WARP mouseWarpPush
#else
#error No mouse warp style for this WAVR_GRADIENT
#endif

// The warped sampling coordinate for `uv`. A uniform branch: with the pointer
// absent (the common case) the whole warp costs nothing.
vec2 mouseWarp(vec2 uv) {
  if (u_mouseReact <= 0.0 || u_mousePresence <= 0.0) return uv;
  return WAVR_MOUSE_WARP(uv);
}
