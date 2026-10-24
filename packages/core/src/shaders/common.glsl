in vec2 v_uv;
out vec4 fragColor;

// Uniforms. The layer and post programs both include this file and each reads
// its own subset (the compiler drops the rest). Every uniform the engine sets
// must also be listed in PROGRAM_UNIFORM_NAMES (engine.ts).
// [layer] = layer.glsl and the gradient functions, [post] = post.glsl.

// [layer] [post] clock, resolution, palette
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_speed;          // post: the last visible layer's, like the palette
uniform float u_softness;
uniform vec3 u_colors[8];       // the raw stops, for gradients that don't blend them
uniform int u_colorCount;
uniform vec3 u_colorsMix[8];    // the stops in blend space: Oklab when u_oklabEnabled, else sRGB
uniform bool u_oklabEnabled;
uniform float u_colorBlend;
uniform sampler2D u_paletteTexture; // baked getGradientColor, see "Palette" below
uniform vec2 u_paletteDomain;       // post: the last visible layer's palette

// [layer] [post] render scale: the share of the composite targets the layers drew into, see compositeUV()
uniform vec2 u_compositeScale;

// [layer] gradient parameters and mouse
uniform vec2 u_mouse;
uniform vec2 u_mouseSmooth;     // smoothed pointer: uv, y up
uniform vec2 u_mouseVelocity;   // its velocity, canvas heights per second (aspect-correct)
uniform float u_mousePresence;  // 0..1, eased: 0 until the pointer has entered, and again after it leaves
uniform float u_mouseReact;
uniform float u_complexity;
uniform float u_scale;
uniform float u_distortion;
uniform float u_domainWarp;
uniform float u_layerOpacity;

// [layer] image / texture
uniform sampler2D u_imageTexture;
uniform sampler2D u_distortionMap;
uniform float u_hasImage;
uniform float u_hasDistortionMap;
uniform float u_imageScale;
uniform vec2 u_imageOffset;
uniform float u_distortionMapIntensity;
uniform int u_imageBlendMode;  // 0=replace, 1=normal, 2=multiply, 3=screen, 4=overlay
uniform float u_imageBlendOpacity;

// [layer] mask
uniform bool u_maskEnabled;
uniform int u_mask1Type;       // 0=none, 1=circle, 2=roundedRect, 3=ellipse, 4=polygon, 5=star, 6=blob
uniform vec2 u_mask1Position;
uniform vec2 u_mask1Scale;
uniform float u_mask1Rotation;
uniform float u_mask1Feather;
uniform float u_mask1Invert;
uniform float u_mask1CornerRadius;
uniform float u_mask1Sides;
uniform float u_mask1StarInner;
uniform float u_mask1NoiseDist;
uniform int u_mask2Type;
uniform vec2 u_mask2Position;
uniform vec2 u_mask2Scale;
uniform float u_mask2Rotation;
uniform float u_mask2Feather;
uniform float u_mask2Invert;
uniform float u_mask2CornerRadius;
uniform float u_mask2Sides;
uniform float u_mask2StarInner;
uniform float u_mask2NoiseDist;
uniform int u_maskBlendMode;   // 0=union, 1=subtract, 2=intersect, 3=smoothUnion
uniform float u_maskSmoothness;

// [layer] text mask
uniform float u_textMaskEnabled;
uniform sampler2D u_textMaskTexture;

// [layer] compositing over the previous layers
uniform int u_blendMode;
uniform bool u_compositeEnabled;
uniform sampler2D u_compositePrev;

// [layer] Parallax depth (Phase 7)
uniform bool u_parallaxEnabled;
uniform float u_parallaxStrength;
uniform float u_layerDepth;

// [layer] 3D Shape Projection (Phase 7)
uniform bool u_3dEnabled;
uniform int u_3dShape;           // 0=sphere, 1=torus, 2=plane, 3=cylinder, 4=cube
uniform float u_3dPerspective;   // 0.5-3.0
uniform float u_3dRotationSpeed;
uniform vec2 u_3dRotation;       // accumulated rotation (azimuth, elevation)
uniform float u_3dZoom;          // 0.5-2.0
uniform float u_3dLighting;      // 0.0-1.0

// [post] the composited layers
uniform sampler2D u_sceneTexture;

// [post] global effects
uniform float u_brightness;
uniform float u_saturation;
uniform bool u_noiseEnabled;
uniform float u_noiseIntensity;
uniform float u_noiseScale;
uniform float u_grain;
uniform bool u_bloomEnabled;
uniform float u_bloomIntensity;
uniform float u_vignette;
uniform float u_radialBlurAmount;
uniform bool u_blurEnabled;
uniform float u_blurAmount;
uniform float u_chromaticAberration;
uniform float u_hueShift;
uniform bool u_asciiEnabled;
uniform float u_asciiSize;
uniform bool u_ditherEnabled;
uniform float u_ditherSize;
uniform int u_toneMapMode; // 0=none, 1=reinhard, 2=aces

// [post] advanced effects
uniform bool u_curlEnabled;
uniform float u_curlIntensity;
uniform float u_curlScale;
uniform bool u_kaleidoscopeEnabled;
uniform float u_kaleidoscopeSegments;
uniform float u_kaleidoscopeRotation;
uniform bool u_reactionDiffEnabled;
uniform float u_reactionDiffIntensity;
uniform float u_reactionDiffScale;
uniform bool u_pixelSortEnabled;
uniform float u_pixelSortIntensity;
uniform float u_pixelSortThreshold;
uniform bool u_feedbackEnabled;
uniform float u_feedbackDecay;
uniform sampler2D u_prevFrame;

// [post] Phase 11 Week 2: Click ripple, soft glow, caustics
uniform vec2 u_rippleOrigin;
uniform float u_rippleTime;     // seconds since the click, real time
uniform float u_rippleEnabled;
uniform float u_rippleIntensity;
uniform bool u_glowEnabled;
uniform float u_glowIntensity;
uniform float u_glowRadius;
uniform bool u_causticEnabled;
uniform float u_causticIntensity;

// [post] Phase 11: Mouse Trail (energy field in R, written by trail.glsl)
uniform bool u_trailEnabled;
uniform sampler2D u_trailTexture;
uniform float u_trailWidth;     // stamp radius, canvas heights

// [post] Phase 11 Week 3: Liquify
uniform bool u_liquifyEnabled;
uniform float u_liquifyIntensity;
uniform float u_liquifyScale;

// [post] Spec 0004: Deband (blue-noise anti-banding, on by default)
uniform bool u_debandEnabled;
uniform float u_debandStrength;

// [post] Cinematic bloom: the bloom pyramid's top level, linear light (engine.ts renderBloomPyramid)
uniform bool u_realBloomEnabled;
uniform float u_realBloomGain;  // strength / the pyramid's level count
uniform sampler2D u_bloomTexture;

// ============================================================
// Simplex Noise 2D
// ============================================================

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// ============================================================
// Fractal Brownian Motion
// ============================================================

float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    p = rot * p;
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// ============================================================
// SDF Shape Primitives (for masking)
// ============================================================

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float sdEllipse(vec2 p, vec2 ab) {
  p = abs(p);
  if (p.x > p.y) { p = p.yx; ab = ab.yx; }
  float l = ab.y * ab.y - ab.x * ab.x;
  float m = ab.x * p.x / l;
  float m2 = m * m;
  float n = ab.y * p.y / l;
  float n2 = n * n;
  float c = (m2 + n2 - 1.0) / 3.0;
  float c3 = c * c * c;
  float q = c3 + m2 * n2 * 2.0;
  float d = c3 + m2 * n2;
  float g = m + m * n2;
  float co;
  if (d < 0.0) {
    float h = acos(q / c3) / 3.0;
    float s = cos(h);
    float t = sin(h) * sqrt(3.0);
    float rx = sqrt(-c * (s + t + 2.0) + m2);
    float ry = sqrt(-c * (s - t + 2.0) + m2);
    co = (ry + sign(l) * rx + abs(g) / (rx * ry) - m) / 2.0;
  } else {
    float h = 2.0 * m * n * sqrt(d);
    float s = sign(q + h) * pow(abs(q + h), 1.0 / 3.0);
    float u = sign(q - h) * pow(abs(q - h), 1.0 / 3.0);
    float rx = -s - u - c * 4.0 + 2.0 * m2;
    float ry = (s - u) * sqrt(3.0);
    float rm = sqrt(rx * rx + ry * ry);
    co = (ry / sqrt(rm - rx) + 2.0 * g / rm - m) / 2.0;
  }
  vec2 r = ab * vec2(co, sqrt(max(1.0 - co * co, 0.0)));
  return length(r - p) * sign(p.y - r.y);
}

float sdPolygon(vec2 p, float r, float n) {
  float an = 3.14159265 / n;
  float he = r * cos(an);
  p = abs(p);
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= vec2(he, 0.0);
  p.y += clamp(-p.y, 0.0, r * sin(an));
  return length(p) * sign(p.x);
}

float sdStar(vec2 p, float r, float n, float m) {
  float an = 3.14159265 / n;
  float en = 3.14159265 / m;
  vec2 acs = vec2(cos(an), sin(an));
  vec2 ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}

float sdBlob(vec2 p, float r, float time, float dist) {
  float angle = atan(p.y, p.x);
  float noise = snoise(vec2(angle * 2.0, time * 0.5)) * dist;
  return length(p) - r * (1.0 + noise * 0.3);
}

// Boolean operations on SDF values
float opUnion(float d1, float d2) { return min(d1, d2); }
float opSubtract(float d1, float d2) { return max(d1, -d2); }
float opIntersect(float d1, float d2) { return max(d1, d2); }
float opSmoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

// ============================================================
// Composite targets at a reduced render scale
// ============================================================

// The composite targets are always full size, but below render scale 1 the
// layers are drawn only into their lower-left corner, u_compositeScale of the
// width and height (1.0 at full scale). `uv` is a position over the drawn
// area, 0..1 like v_uv in the layer pass (the post pass upsamples it to the
// whole canvas); this gives the matching texture coordinate. It stays half a
// texel inside the drawn area, as CLAMP_TO_EDGE does at the edge of a texture,
// so filtering never reads texels that were not drawn this frame. At scale 1
// it is exactly the clamped uv.
vec2 compositeUV(vec2 uv, vec2 targetSize) {
  vec2 halfTexel = 0.5 / targetSize;
  return clamp(uv * u_compositeScale, halfTexel, u_compositeScale - halfTexel);
}

// ============================================================
// Palette
// ============================================================

// The layer's palette (stops, Oklab or sRGB interpolation, colour blend and
// softness) is evaluated on the CPU, once per change, into a 1D texture of
// PALETTE_TEXELS (palette.ts is the source of the maths). The texture covers
// t in [-reach, 1 + reach], where reach is how far the blend still moves the
// colour past the ends; u_paletteDomain maps t to a coordinate along it.
const float PALETTE_TEXELS = 512.0;

// Back from u_colorsMix space to sRGB, once per pixel for gradients that blend
// the stops themselves (mesh). The forward conversion is done on the CPU.
vec3 mixSpaceToSrgb(vec3 c) {
  if (!u_oklabEnabled) return c;
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  vec3 lin = max(vec3(
     4.0767416621 * l * l * l - 3.3077115913 * m * m * m + 0.2309699292 * s * s * s,
    -1.2684380046 * l * l * l + 2.6097574011 * m * m * m - 0.3413193965 * s * s * s,
    -0.0041960863 * l * l * l - 0.7034186147 * m * m * m + 1.7076147010 * s * s * s
  ), vec3(0.0));
  return mix(lin * 12.92, 1.055 * pow(lin, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), lin));
}

vec3 getGradientColor(float t) {
  float u = clamp(t * u_paletteDomain.x + u_paletteDomain.y, 0.0, 1.0);
  // Texel centres: u = 0 and u = 1 are the middles of the first and last texel.
  // textureLod: callers sit in loops and branches (no implicit derivatives).
  return textureLod(u_paletteTexture, vec2((u * (PALETTE_TEXELS - 1.0) + 0.5) / PALETTE_TEXELS, 0.5), 0.0).rgb;
}

// ============================================================
// Gradient field helpers
// ============================================================
// The gradient functions turn a smooth scalar field into a palette position.
// These keep that mapping free of seams, flat plateaus and added white.

float soft01(float v) {
  return smoothstep(0.02, 0.98, clamp(v, 0.0, 1.0));
}

float signedTo01(float v) {
  return clamp(v * 0.5 + 0.5, 0.0, 1.0);
}

// Centred, aspect-corrected coordinates: one unit is the canvas height, so
// forms stay round on any viewport.
vec2 centeredUV(vec2 uv) {
  return (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
}

// Mirrored wrap: 0 -> 1 -> 0 -> 1, where fract() would jump from 1 straight back
// to 0 (a hard seam in the palette). The palette is flat at both ends, so the
// fold leaves no crease either. Period 2, so anything that must close on itself
// (an angle) has to advance by a multiple of 2 per turn.
float pingPong(float x) {
  return 1.0 - abs(1.0 - 2.0 * fract(x * 0.5));
}

// Keeps coordinates inside the canvas by folding them back smoothly (a sine
// that is nearly the identity near the middle and has a zero slope where it
// turns), so a layout built for one canvas repeats, mirrored, when the scale
// zooms out past it, with no crease where it folds.
vec2 softFold(vec2 p) {
  vec2 h = vec2(0.62 * u_resolution.x / u_resolution.y, 0.62);
  return h * sin(p / h);
}

// Contrast about the middle. Noise clusters around 0.5 and rarely reaches the
// ends of the palette, so a raw field comes out as its average colour. Follow
// with pingPong() so the stretched tails fold back instead of clamping flat.
float spread01(float v, float gain) {
  return 0.5 + (v - 0.5) * gain;
}

// A palette colour for a field that may leave 0..1.
vec3 foldedColor(float x) {
  return getGradientColor(pingPong(x));
}

vec2 softDomainWarp(vec2 p, float time, float amount) {
  vec2 q = vec2(
    sin(p.y * 2.4 + time * 0.38) + 0.45 * sin((p.x + p.y) * 1.6 - time * 0.22),
    cos(p.x * 2.0 - time * 0.31) + 0.4 * sin((p.x - p.y) * 2.2 + time * 0.18)
  );
  q *= 0.18;
  return p + q * amount;
}

// Satin light on a height field. The field's own screen-space slope (derivatives,
// so no extra evaluations) says whether a point faces a light in the upper left:
// +1 lifts toward it, -1 turns away, 0 is flat. Soft-signed, so it never goes
// harsh. The slope is per canvas height, so it looks the same at any resolution.
float satin(float height, float relief) {
  vec2 slope = vec2(dFdx(height), dFdy(height)) * (u_resolution.y * relief);
  float lit = dot(slope, vec2(-0.6, 0.8));
  return lit / (1.0 + abs(lit));
}

// Multiplier for a colour under satin light. Shadowed folds deepen the colour,
// lit ones lift it a little; flat areas keep the palette colour as it is, and
// since it only scales the colour it never pushes it toward white.
float satinShade(float satinLight, float strength) {
  return 1.0 + strength * (0.32 * min(satinLight, 0.0) + 0.12 * max(satinLight, 0.0));
}

// Palette colour at `t` (0..1), lit like satin by the slope of `height`.
vec3 satinColor(float t, float height, float relief) {
  return getGradientColor(t) * satinShade(satin(height, relief), 1.0);
}

// The soft modes' palette lookup: an S-curve on the field (so colours hold in
// the middle of a form and change at its edges), lit like satin by `relief`.
vec3 finishSoftGradient(float field, float relief) {
  return satinColor(smoothstep(0.0, 1.0, clamp(field, 0.0, 1.0)), field, relief);
}

// ============================================================
// Light (the light-field gradients)
// ============================================================
// Light adds, blurs and spills in linear light, not in sRGB, so the light
// fields convert their stops with srgbToLinear(), work there, and come back
// through lightToDisplay().

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

// erf(x), within 2e-4 (Winitzki's approximation).
float erfApprox(float x) {
  float x2 = x * x;
  float t = x2 * (1.2732395 + 0.147 * x2) / (1.0 + 0.147 * x2);
  return sign(x) * sqrt(1.0 - exp(-t));
}

// A uniformly lit box of half size `halfSize`, centred on the origin, seen
// through a Gaussian blur of `sigma` (per axis): the exact convolution, a
// product of two erfs. 1 deep inside a box much larger than sigma, falling off
// around it as light spreading in two dimensions does, so a glow of any radius
// costs the same and never bands or rings.
float blurredBox(vec2 p, vec2 halfSize, vec2 sigma) {
  vec2 s = 0.70710678 / sigma;
  vec2 a = (p + halfSize) * s;
  vec2 b = (p - halfSize) * s;
  return 0.25 * (erfApprox(a.x) - erfApprox(b.x)) * (erfApprox(a.y) - erfApprox(b.y));
}

// The stops as light: position `x` in stops (0 = the first stop, count - 1 =
// the last), linear. A Catmull-Rom curve through the raw stops: it passes
// through each one without pausing there, so light changes continuously
// instead of banding at every stop, and the layer's softness (which blurs the
// baked palette) leaves the stops themselves alone. `first` and `last` bound
// the stops the curve may use.
vec3 lightStop(int i, int first, int last) {
  return srgbToLinear(u_colors[clamp(i, first, last)]);
}

vec3 lightStops(float x, int first, int last) {
  x = clamp(x, float(first), float(last));
  int i = int(floor(x));
  float f = x - float(i);
  vec3 p0 = lightStop(i - 1, first, last);
  vec3 p1 = lightStop(i, first, last);
  vec3 p2 = lightStop(i + 1, first, last);
  vec3 p3 = lightStop(i + 2, first, last);
  vec3 c = p1 + 0.5 * f * (p2 - p0 + f * (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3 + f * (3.0 * (p1 - p2) + p3 - p0)));
  return max(c, 0.0);
}

// The whole ramp as light, t = 0 (the first stop) to 1 (the last).
vec3 lightRamp(float t) {
  int last = max(u_colorCount - 1, 0);
  return lightStops(t * float(last), 0, last);
}

// Linear light to display sRGB. Light below the knee passes through, so a
// palette colour shows as picked (a channel at 1 comes back within two 8-bit
// levels). Above it the brightest channel rolls off toward 1 on a short C1
// shoulder, and the light that no longer fits bleaches the colour toward white,
// keeping its hue, as bright coloured light does on film and in the eye.
vec3 lightToDisplay(vec3 c) {
  c = max(c, 0.0);
  float m = max(max(c.r, c.g), c.b);
  const float KNEE = 0.94;
  if (m > KNEE) {
    float shoulder = KNEE + (1.0 - KNEE) * tanh(min((m - KNEE) / (1.0 - KNEE), 10.0));
    c = mix(c * (shoulder / m), vec3(shoulder), 1.0 - shoulder / m);
  }
  return linearToSrgb(c);
}

// White noise, one value per `cell` pixels. The cell grows with the canvas
// (about 540 px of height per grain), so grain looks the same in a 4x export as
// on screen. An integer hash: no sine, so no pattern, and no drift between GPUs.
float grain01(vec2 fragCoord) {
  float cell = max(1.0, floor(u_resolution.y / 540.0 + 0.5));
  uvec2 q = uvec2(floor(fragCoord / cell)) * uvec2(1597334673u, 3812015801u);
  uint n = (q.x ^ q.y) * 1597334673u;
  n ^= n >> 15u;
  n *= 2246822519u;
  n ^= n >> 13u;
  return float(n >> 8u) * (1.0 / 16777216.0);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float interleavedGradientNoise(vec2 fragCoord) {
  vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
  return fract(magic.z * fract(dot(fragCoord, magic.xy)));
}

// ============================================================
// Voronoi / Worley Noise
// ============================================================

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

vec2 voronoi(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);

  float md = 8.0;
  vec2 mr;

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) {
        md = d;
        mr = r;
      }
    }
  }
  return vec2(sqrt(md), dot(mr, normalize(mr)));
}

// Cellular noise whose feature points drift inside their cells, so the cells
// morph rather than slide. x = distance to the nearest point, y = to the second
// nearest (y - x is 0 on a border), z = a random 0..1 value of the nearest cell;
// `id2` is that value for the second nearest, to blend across the border.
vec3 cellular(vec2 p, float time, out float id2) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  float id = 0.0;
  id2 = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 h = hash22(n + g);
      vec2 o = 0.5 + 0.38 * sin(time + 6.2831 * h);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) {
        d2 = d1;
        id2 = id;
        d1 = d;
        id = hash(n + g + 17.3);
      } else if (d < d2) {
        d2 = d;
        id2 = hash(n + g + 17.3);
      }
    }
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}

// ============================================================
// Mask Evaluation
// ============================================================

float evaluateMaskSDF(vec2 uv, int type, vec2 pos, vec2 scl, float rot,
                      bool invert, float cornerRadius, float sides, float starInner,
                      float noiseDist, float time) {
  if (type == 0) return -1.0; // none = fully inside

  vec2 p = uv - 0.5 - pos;
  float c = cos(rot), s = sin(rot);
  p = mat2(c, s, -s, c) * p;
  p /= scl;

  float aspect = u_resolution.x / u_resolution.y;
  p.x *= aspect;

  float d;
  if (type == 1) d = sdCircle(p, 0.4);
  else if (type == 2) d = sdRoundedBox(p, vec2(0.4), cornerRadius);
  else if (type == 3) d = sdEllipse(p, vec2(0.4, 0.3));
  else if (type == 4) d = sdPolygon(p, 0.4, sides);
  else if (type == 5) d = sdStar(p, 0.4, sides, starInner * sides);
  else d = sdBlob(p, 0.4, time, noiseDist);

  if (type != 6 && noiseDist > 0.01) {
    d += snoise(p * 8.0 + time * 0.3) * noiseDist * 0.1;
  }

  if (invert) d = -d;
  return d;
}

float computeMask(vec2 uv, float time) {
  if (!u_maskEnabled) return 1.0;
  if (u_mask1Type == 0) return 1.0;

  float d1 = evaluateMaskSDF(uv, u_mask1Type, u_mask1Position, u_mask1Scale,
    u_mask1Rotation, u_mask1Invert > 0.5,
    u_mask1CornerRadius, u_mask1Sides, u_mask1StarInner, u_mask1NoiseDist, time);

  if (u_mask2Type == 0) {
    return 1.0 - smoothstep(-u_mask1Feather, u_mask1Feather, d1);
  }

  float d2 = evaluateMaskSDF(uv, u_mask2Type, u_mask2Position, u_mask2Scale,
    u_mask2Rotation, u_mask2Invert > 0.5,
    u_mask2CornerRadius, u_mask2Sides, u_mask2StarInner, u_mask2NoiseDist, time);

  float combined;
  if (u_maskBlendMode == 0) combined = opUnion(d1, d2);
  else if (u_maskBlendMode == 1) combined = opSubtract(d1, d2);
  else if (u_maskBlendMode == 2) combined = opIntersect(d1, d2);
  else combined = opSmoothUnion(d1, d2, u_maskSmoothness);

  float feather = max(u_mask1Feather, u_mask2Feather);
  return 1.0 - smoothstep(-feather, feather, combined);
}
