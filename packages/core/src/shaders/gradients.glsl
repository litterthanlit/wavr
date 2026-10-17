// Every gradient mode, each guarded so a layer program contains exactly one of
// them. The engine compiles the layer program with `#define WAVR_GRADIENT <id>`
// (ids: GRADIENT_TYPE_IDS in engine.ts). A new mode needs its own guard here and
// a branch in computeGradient() at the bottom.
//
// House rules for the modes that are meant to be gradients (everything except
// dither, scanline, glitch and image, which are graphic on purpose):
// - A few broad, slow forms. Fewer, wider features read as calm; many thin ones
//   read as noise and alias at 4K. Coordinates are aspect-corrected
//   (centeredUV) so forms stay round on any viewport.
// - The field goes to the palette through pingPong() (or a sine), never fract():
//   the palette runs back and forth and never jumps from its last colour to its
//   first. Angles advance by a multiple of 2 per turn (pingPong's period) so
//   they close on themselves.
// - Noise clusters around the middle, so stretch it (spread01) or the palette's
//   end colours never appear and everything comes out the average of the lot.
// - Never add white. Brightness comes from the palette; depth comes from
//   multiplying by satin() light, which only ever deepens or lifts the colour.
// - No pixel-scale patterns (grainflow's grain is white noise sized from the canvas
//   height, so it is the same in a 4x export), and nothing that jumps in time.
// Mouse interaction is mouseWarp() in layer.glsl, not here.

// ============================================================
// Core gradients
// ============================================================

// Mesh: one soft blob of colour per palette entry, drifting on slow orbits, the
// colours blended where the blobs meet, like a mesh gradient in a design tool.
// Complexity above 3 adds more blobs, repeating the palette. The blend is done
// on the palette colours themselves (in Oklab when that is on), not by walking
// the palette as a ramp, so each colour keeps its own place and never turns
// into the average of the rest.
#if WAVR_GRADIENT == 0
vec3 meshGradient(vec2 uv, float time) {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = centeredUV(uv) * u_scale;
  float warp = u_distortion + u_domainWarp * 0.6;
  // The sheet itself is gently warped (one low octave).
  p += (0.1 + 0.4 * warp) * vec2(
    snoise(p * 0.8 + vec2(time * 0.05, 3.1)),
    snoise(p * 0.8 + vec2(7.3, -time * 0.05))
  );
  // Past the canvas the layout folds back instead of extending.
  p = softFold(p);

  int n = clamp(u_colorCount + max(int(u_complexity) - 3, 0), 2, 8);
  float fn = float(n);
  float sharp = mix(14.0, 8.0, max(u_softness, u_colorBlend));
  vec3 acc = vec3(0.0);
  float wsum = 1e-9;
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    float fi = float(i);
    float a = fi * 2.39996 + 0.7;
    vec2 c = vec2(cos(a) * aspect, sin(a)) * (0.16 + 0.26 * sqrt((fi + 0.5) / fn));
    vec2 h = hash22(vec2(fi, 1.0));
    c += 0.16 * vec2(sin(time * (0.35 + 0.2 * h.x) + fi * 2.1), cos(time * (0.3 + 0.2 * h.y) + fi * 1.7));
    vec2 d = p - c;
    float w = exp(-dot(d, d) * sharp);
    vec3 col = u_colors[i % u_colorCount];
    if (u_oklabEnabled) col = linearToOklab(srgbToLinear(col));
    acc += w * col;
    wsum += w;
  }
  vec3 mixed = acc / wsum;
  if (u_oklabEnabled) mixed = linearToSrgb(max(oklabToLinear(mixed), vec3(0.0)));
  return mixed;
}
#endif

// Radial: soft rings breathing out from a centre that drifts a little.
#if WAVR_GRADIENT == 1
vec3 radialGradient(vec2 uv, float time) {
  vec2 p = centeredUV(uv) - 0.07 * vec2(sin(time * 0.31), cos(time * 0.27));
  p *= u_scale;
  float r = length(p);
  // A whole number of lobes, so the shape closes on itself.
  float ang = atan(p.y, p.x);
  float lobes = sin(ang * 2.0 + time * 0.2) + sin(ang * 3.0 - time * 0.15);
  r += u_distortion * (0.05 * lobes * smoothstep(0.0, 0.35, r) + 0.2 * snoise(p * 1.1 + time * 0.08));
  float t = r * (0.55 + 0.2 * u_complexity) - time * 0.04;
  return foldedColor(t);
}
#endif

// Linear: one broad ramp across the canvas, the direction swaying and the
// ramp rippling like a flag in a light wind.
#if WAVR_GRADIENT == 2
vec3 linearGradient(vec2 uv, float time) {
  vec2 p = centeredUV(uv) * u_scale;
  float a = 0.55 + 0.12 * sin(time * 0.13);
  vec2 dir = vec2(cos(a), sin(a));
  float across = dot(p, vec2(-dir.y, dir.x));
  float wave = sin(across * (1.0 + 0.4 * u_complexity) + time * 0.35);
  float t = 0.5 + dot(p, dir) * 0.85
          + u_distortion * (0.14 * wave + 0.3 * snoise(p * 0.8 + vec2(time * 0.06, 0.0)));
  return foldedColor(t);
}
#endif

// Conic: the palette sweeps around a centre. The angle advances by a multiple
// of 2 per turn, so there is no cut line, and the very middle eases to the
// middle of the palette instead of pinching to a point.
#if WAVR_GRADIENT == 3
vec3 conicGradient(vec2 uv, float time) {
  vec2 p = centeredUV(uv) - 0.05 * vec2(sin(time * 0.23), cos(time * 0.19));
  p *= u_scale;
  float r = length(p);
  float sweeps = float(1 + int(u_complexity) / 4);
  float x = atan(p.y, p.x) * (0.31831 * sweeps) + r * (0.8 * u_distortion) - time * 0.06
          + u_distortion * 0.12 * snoise(p * 1.2 + time * 0.05);
  return getGradientColor(mix(0.5, pingPong(x), smoothstep(0.0, 0.1, r)));
}
#endif

// Plasma: interfering sine waves on a slowly swirling sheet, broad and slow,
// mapped through a sine so the palette folds smoothly wherever the field peaks.
#if WAVR_GRADIENT == 4
vec3 plasmaGradient(vec2 uv, float time) {
  vec2 p = centeredUV(uv) * u_scale * 3.0;
  p += 0.35 * vec2(sin(p.y * 0.7 + time * 0.2), cos(p.x * 0.6 - time * 0.17));
  float f = 0.85 + 0.2 * u_complexity;
  float v = sin(p.x * f + time * 0.3)
          + sin(p.y * f * 0.9 + time * 0.22)
          + sin((p.x + p.y) * f * 0.6 + time * 0.25)
          + sin(length(p + 0.8 * vec2(sin(time * 0.12), cos(time * 0.16))) * f * 1.1);
  v = v * 0.25 + u_distortion * 0.35 * snoise(p * 0.5 + time * 0.05);
  float t = 0.5 + 0.5 * sin(v * mix(3.0, 1.7, u_softness));
  return getGradientColor(t);
}
#endif

// Voronoi: stained-glass cells. Each cell takes its own place on the palette,
// shaded softly toward its edge, with a fine soft seam between neighbours.
#if WAVR_GRADIENT == 9
vec3 voronoiGradient(vec2 uv, float time) {
  vec2 p = centeredUV(uv) * u_scale * (1.6 + 0.5 * u_complexity);
  p += u_distortion * 0.5 * vec2(snoise(p * 0.35 + vec2(time * 0.05, 1.7)), snoise(p * 0.35 + vec2(4.1, -time * 0.05)));
  vec3 c = cellular(p, time * 0.5);
  float t = c.z + (c.x - 0.35) * 0.35;
  float seam = smoothstep(0.0, 0.05 + 0.2 * u_softness, c.y - c.x);
  return foldedColor(t) * mix(0.8, 1.0, seam);
}
#endif

// ============================================================
// Soft premium modes
// ============================================================

// Silk: long satin folds. The palette runs back and forth across a few broad
// ripples of a slowly warped sheet; the light catches each fold, so it reads as
// cloth rather than as stripes.
#if WAVR_GRADIENT == 10
vec3 silkGradient(vec2 uv, float time) {
  vec2 p = centeredUV(uv) * u_scale;
  p = softDomainWarp(p, time, 0.35 + u_distortion * 1.2 + u_domainWarp * 0.9);
  float bands = 0.6 + 0.15 * u_complexity;
  float phase = (dot(p, vec2(0.55, 0.85)) * bands + 0.12 * sin(dot(p, vec2(-0.9, 0.45)) * 2.1 + time * 0.2)) * 6.28318
              + time * 0.25;
  float t = 0.5 + 0.5 * sin(phase);
  return satinColor(t, t, 0.5 + 0.5 * u_softness);
}
#endif

// Aurora: curtains of light in a dark sky. The curtain is a set of vertical
// folds that sway as they rise; it is brightest low down and dissolves into the
// sky toward the top. The palette's first colour is the sky and its last the
// crest of a fold, so the brightness is the palette's, not added.
#if WAVR_GRADIENT == 11
vec3 auroraGradient(vec2 uv, float time) {
  vec2 p = centeredUV(uv) * u_scale;
  float drift = time * 0.1;
  p.x += 0.2 * u_domainWarp * snoise(vec2(p.y * 0.7, drift * 1.3));
  float sway = (0.55 * snoise(vec2(p.x * 0.7 + drift, p.y * 0.9)) + 0.2 * sin(p.y * 1.6 + drift * 2.0))
             * (0.35 + 0.65 * u_distortion);
  float phase = (p.x * (0.35 + 0.15 * u_complexity) + sway) * 6.28318 + drift * 2.0;
  float fold = 0.5 + 0.5 * sin(phase);
  // two folds of different widths, so the curtain is not a regular stripe
  fold = 0.65 * fold + 0.35 * (0.5 + 0.5 * sin(phase * 1.7 + 1.3 + sway * 3.0));
  float sky = 1.0 - smoothstep(-0.5 - 0.1 * u_softness, 0.7 + 0.2 * u_softness, p.y + 0.15 * sway);
  float glow = fold * sky;
  return finishSoftGradient(glow * 1.15, 0.0);
}
#endif

// Liquid: a few blobs that merge and part like mercury, lit from one side.
// Complexity adds blobs; past the canvas the layout folds back.
#if WAVR_GRADIENT == 12
vec3 liquidGradient(vec2 uv, float time) {
  vec2 p = centeredUV(uv) * u_scale;
  p = softFold(softDomainWarp(p, time, u_distortion * 0.9 + 0.2));
  int n = clamp(int(u_complexity) + 2, 3, 7);
  float field = 0.0;
  for (int i = 0; i < 7; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 c = vec2(0.42 * sin(time * (0.2 + fi * 0.03) + fi * 2.31),
                  0.34 * cos(time * (0.17 + fi * 0.035) + fi * 1.73));
    float r = 0.16 + hash(vec2(fi, 2.0)) * 0.12;
    vec2 d = p - c;
    field += r * r / (dot(d, d) + 0.01 + 0.03 * u_softness);
  }
  float h = smoothstep(0.15, 0.85, 1.0 - exp(-field * 0.5));
  return satinColor(smoothstep(0.0, 1.0, spread01(h, 1.15)), h, 1.1);
}
#endif

// Soft cells: pillowy cells whose colours bleed into each other, each one
// domed toward its centre. The grid is turned and its points jittered across
// their whole cell so it does not read as squares, and every cell's weight
// falls to exactly zero before the 3x3 window ends so no cell edge shows.
#if WAVR_GRADIENT == 13
vec3 softCellsGradient(vec2 uv, float time) {
  vec2 p = centeredUV(uv) * u_scale * (1.4 + 0.4 * u_complexity);
  p = softDomainWarp(p, time, u_distortion * 0.9);
  p = mat2(0.8, 0.6, -0.6, 0.8) * p;
  vec2 cell = floor(p);
  vec2 f = fract(p);
  float k = mix(9.0, 4.5, u_softness);
  float edge = exp(-k * 1.21);
  float acc = 0.0;
  float dome = 0.0;
  float wsum = 1e-7;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 h = hash22(cell + g);
      vec2 o = 0.5 + 0.42 * sin(time * 0.4 + 6.2831 * h);
      vec2 d = g + o - f;
      float w = max(exp(-dot(d, d) * k) - edge, 0.0);
      acc += w * hash(cell + g + 7.7);
      dome += w * w;
      wsum += w;
    }
  }
  // dome: 1 at a cell's centre, falling toward the seams between cells
  dome = clamp(dome / (wsum * wsum), 0.0, 1.0);
  float t = smoothstep(0.0, 1.0, clamp(spread01(acc / wsum, 1.7), 0.0, 1.0));
  return getGradientColor(t) * mix(0.72, 1.0, dome);
}
#endif

// Grainflow: slow clouds of colour with a fine grain dithered into the
// transitions, like a risograph print. The grain is in the colour, not on it,
// so flat areas stay clean and it sharpens only where one colour meets another.
#if WAVR_GRADIENT == 14
vec3 grainflowGradient(vec2 uv, float time) {
  vec2 p = centeredUV(uv) * u_scale * 1.3;
  p = softDomainWarp(p, time, 0.4 + u_distortion);
  float field = 0.5 + 0.5 * snoise(p * (0.7 + 0.07 * u_complexity) + vec2(time * 0.1, time * 0.04));
  field += (0.1 + 0.03 * u_complexity) * snoise(p * 1.7 + vec2(-time * 0.06, time * 0.09));
  field += (grain01(gl_FragCoord.xy) - 0.5) * 0.13 * (0.4 + u_softness);
  return finishSoftGradient(spread01(field, 1.5), 0.0);
}
#endif

// Prism glass: soft ribbons seen through reeded glass. Each flute is a small
// lens that shifts the scene behind it, and the shift differs a little between
// red and blue, so the flutes fringe like a prism without any added light. The
// fringe is a first-order shift of the colour along x, taken from its screen-space
// derivative, so the palette is read once.
#if WAVR_GRADIENT == 15
float prismField(vec2 p, float time) {
  p = softDomainWarp(p, time, 0.5 + u_distortion);
  float h = sin(dot(p, vec2(1.0, -0.6)) * 2.2 + time * 0.2)
          + 0.6 * sin(dot(p, vec2(0.5, 1.0)) * 2.9 - time * 0.15);
  return smoothstep(0.0, 1.0, clamp(0.5 + 0.3 * h, 0.0, 1.0));
}
#endif

#if WAVR_GRADIENT == 15
vec3 prismGlassGradient(vec2 uv, float time) {
  vec2 q = centeredUV(uv);
  vec2 p = q * u_scale * 1.1;
  float flutes = 5.0 + 1.2 * u_complexity;
  float lens = sin(q.x * flutes * 6.28318);
  float amount = 0.01 + 0.025 * u_distortion;
  vec3 color = getGradientColor(prismField(p + vec2(lens * amount, 0.0), time));
  // Red reads a little to one side of the flute's lens, blue a little to the other, in pixels.
  float shift = (0.3 + 0.7 * abs(lens)) * amount * 0.5 * u_resolution.y;
  vec3 slope = dFdx(color);
  color.r -= slope.r * shift;
  color.b += slope.b * shift;
  return color * (0.92 + 0.08 * cos(q.x * flutes * 6.28318));
}
#endif

// Neon tunnel: rings receding into a soft vanishing point, swirling slowly. The
// angle advances by 2 per turn (pingPong's period), so the spiral has no seam;
// the vanishing point itself eases to a flat colour so it does not pinch.
#if WAVR_GRADIENT == 16
vec3 neonTunnelGradient(vec2 uv, float time) {
  vec2 p = centeredUV(uv) * u_scale;
  float r = length(p);
  float depth = 1.0 / (0.3 + r * 1.6);
  float x = depth * (0.6 + 0.05 * u_complexity) - time * 0.2
          + atan(p.y, p.x) * 0.31831 + depth * 0.3 * u_distortion;
  float core = smoothstep(0.0, 0.1, r);
  return getGradientColor(mix(0.5, pingPong(x), core)) * mix(0.7, 0.6 + 0.4 * smoothstep(0.2, 1.2, depth), core);
}
#endif

// ============================================================
// Dither / Halftone Gradient
// ============================================================

#if WAVR_GRADIENT == 5
vec3 ditherGradient(vec2 uv, float time) {
  // Cell grid. Sized from the canvas height, not in pixels, so an export at 4x
  // is the same picture as the live view.
  float cellSize = max(u_scale * 0.016 * u_resolution.y, 2.0);
  vec2 cellCoord = gl_FragCoord.xy / cellSize;
  vec2 cellId = floor(cellCoord);
  vec2 cellUV = fract(cellCoord) - 0.5;

  // The field is read once per cell, at its centre, so every dot is a clean circle.
  vec2 cp = (cellId + 0.5) * cellSize / u_resolution;
  float organicMix = clamp((u_complexity - 1.0) / 7.0, 0.0, 1.0);
  float cellClean = 1.0 - cp.y;
  vec2 np = centeredUV(cp) * u_scale * 2.0;
  float warp = u_distortion + u_domainWarp * 0.5;
  float n1 = snoise(np * 0.8 + vec2(time * 0.2, time * 0.14));
  float n2 = snoise(np * 0.8 + vec2(n1 * warp + time * 0.08, n1 * warp - time * 0.1));
  float cellOrganic = n2 * 0.5 + 0.5;
  float cellLum = mix(cellClean, cellOrganic, organicMix);
  cellLum += snoise(centeredUV(cp) * u_scale + vec2(time * 0.15, time * 0.1)) * u_distortion * 0.3 * (1.0 - organicMix * 0.5);
  cellLum = clamp(cellLum, 0.0, 1.0);

  // Luminance sets the dot's size; the edge is one device pixel wide.
  float dotRadius = cellLum * 0.5;
  float dist = length(cellUV);
  float aa = 1.0 / cellSize;
  float inDot = 1.0 - smoothstep(dotRadius - aa, dotRadius + aa, dist);

  // colors[0] = dot colour, colors[1] = background.
  vec3 dotColor = u_colors[0];
  vec3 bgColor = u_colorCount > 1 ? u_colors[1] : vec3(1.0);
  vec3 crisp = mix(bgColor, dotColor, inDot);
  vec3 softBase = getGradientColor(cellLum);
  vec3 softened = mix(softBase, dotColor, inDot * 0.45);
  return mix(crisp, softened, u_softness * 0.85);
}
#endif

// ============================================================
// Scanline / CRT Gradient
// ============================================================

// Scanline: columns of palette colour rising from the bottom, with a fine
// scanline texture. Each pixel belongs to one column, so any column count fits.
#if WAVR_GRADIENT == 6
vec3 scanlineGradient(vec2 uv, float time) {
  vec2 p = uv;

  float numColumns = floor(u_complexity * 3.0 + 2.0); // 5 to 26
  float colF = p.x * numColumns;
  float fi = floor(colF);
  float dx = abs(fract(colF) - 0.5);
  float colMask = 1.0 - smoothstep(0.34, 0.48, dx);
  // a soft halo either side of the bar, so it glows into the dark instead of cutting out of it
  float halo = 1.0 - smoothstep(0.3, 0.9, dx);

  // Each column rises to its own height, swaying slowly.
  float heightSeed = hash(vec2(fi * 7.13, 3.17));
  float blockHeight = clamp(0.45 + heightSeed * 0.5 + sin(time * 0.4 + fi * 1.7) * u_distortion * 0.15, 0.15, 0.97);
  float blockMask = 1.0 - smoothstep(blockHeight - 0.08, blockHeight + 0.02, p.y);
  float inBlock = 1.0 - smoothstep(0.0, blockHeight + 0.15, p.y);

  vec3 blockColor = u_colors[int(mod(fi, float(u_colorCount)))];
  // The column brightens toward its crown instead of ending in a flat edge.
  vec3 bar = blockColor * mix(0.65, 1.0, smoothstep(0.0, 1.0, p.y / blockHeight));

  // The empty background is a tint of the palette, never pure black, lifting toward the bottom.
  vec3 bg = mix(u_colors[0], u_colors[u_colorCount - 1], p.x) * (0.1 + 0.12 * (1.0 - p.y));
  vec3 color = mix(bg, blockColor * 0.4, halo * inBlock * 0.55);
  color = mix(color, bar, colMask * blockMask);

  // Scanlines: a fixed number per canvas height, so they match at any size. They
  // fade out where a period gets under about 3 px, rather than alias into moire.
  float lines = 0.5 + 0.5 * sin(p.y * 240.0 * 3.14159);
  float visible = smoothstep(1.5, 4.0, u_resolution.y / 120.0);
  return color * mix(1.0, mix(0.8, 1.0, lines), visible);
}
#endif

// ============================================================
// Glitch / Data Drag Gradient
// ============================================================

// Glitch: a smooth gradient torn into slices. Low complexity drags every column
// to a different height (slit-scan); higher complexity slides horizontal bands
// sideways instead. Offsets step slowly and the red channel trails the others.
#if WAVR_GRADIENT == 7
vec3 glitchColor(vec2 q, float time) {
  return foldedColor(0.15 + q.x * 0.9 + q.y * 0.35 + 0.12 * sin(q.y * 5.0 + time * 0.3));
}
#endif

#if WAVR_GRADIENT == 7
vec3 glitchGradient(vec2 uv, float time) {
  vec2 p = uv;
  float moshMix = clamp((u_complexity - 1.0) / 7.0, 0.0, 1.0);

  // Slit-scan: each column reads the gradient from a height of its own.
  float numCols = 20.0 + u_complexity * 4.0;
  float colId = floor(p.x * numCols);
  float dragSeed = hash(vec2(colId, 1.0));
  float drag = (dragSeed * 0.7 + 0.1 + sin(time * 0.3 + colId * 0.7) * 0.2) * u_distortion * (1.0 - moshMix * 0.7);
  p.y = mix(p.y, dragSeed * 0.5 + 0.25, drag);

  // Displaced bands: each one slides sideways by a block-sized step.
  float bandScale = 8.0 + u_complexity * 2.0;
  float bandId = floor(p.y * bandScale);
  float bandSeed = hash(vec2(bandId, 7.77));
  float live = smoothstep(0.35 - u_distortion * 0.3, 0.55 - u_distortion * 0.3, bandSeed);
  float stepTime = floor(time * 0.6 + bandId * 0.37);
  float smear = (hash(vec2(bandId, stepTime)) * 2.0 - 1.0) * (0.04 + 0.3 * u_distortion) * live * (0.4 + moshMix);
  float blockSize = mix(0.02, 0.1, hash(vec2(bandId, 13.31))) * u_scale;
  smear = floor(smear / blockSize + 0.5) * blockSize;

  vec2 q = vec2(p.x + smear, p.y);
  float trail = 0.015 * live * (0.3 + u_distortion);
  vec3 color = glitchColor(q, time);
  color.r = glitchColor(q - vec2(trail, 0.0), time).r;

  // A fine dark seam between bands.
  float bandFrac = fract(p.y * bandScale);
  float seam = smoothstep(0.0, 0.08, bandFrac) * (1.0 - smoothstep(0.92, 1.0, bandFrac));
  return color * mix(0.86, 1.0, max(seam, 1.0 - live));
}
#endif

// ============================================================
// Image Gradient (type 8) — samples uploaded texture
// ============================================================

#if WAVR_GRADIENT == 8
vec3 imageGradient(vec2 uv, float time) {
  vec2 imgUV = (uv - 0.5) / u_imageScale + 0.5 + u_imageOffset;
  return texture(u_imageTexture, clamp(imgUV, 0.0, 1.0)).rgb;
}
#endif

// ============================================================
// Gradient Dispatch
// ============================================================

// Only the branch for this program's gradient is compiled. The Custom GLSL
// program defines WAVR_CUSTOM instead; the engine puts its customGradient()
// ahead of this file.
vec3 computeGradient(vec2 uv, float time) {
#if defined(WAVR_CUSTOM)
  return customGradient(uv, time);
#elif WAVR_GRADIENT == 0
  return meshGradient(uv, time);
#elif WAVR_GRADIENT == 1
  return radialGradient(uv, time);
#elif WAVR_GRADIENT == 2
  return linearGradient(uv, time);
#elif WAVR_GRADIENT == 3
  return conicGradient(uv, time);
#elif WAVR_GRADIENT == 4
  return plasmaGradient(uv, time);
#elif WAVR_GRADIENT == 5
  return ditherGradient(uv, time);
#elif WAVR_GRADIENT == 6
  return scanlineGradient(uv, time);
#elif WAVR_GRADIENT == 7
  return glitchGradient(uv, time);
#elif WAVR_GRADIENT == 8
  return imageGradient(uv, time);
#elif WAVR_GRADIENT == 9
  return voronoiGradient(uv, time);
#elif WAVR_GRADIENT == 10
  return silkGradient(uv, time);
#elif WAVR_GRADIENT == 11
  return auroraGradient(uv, time);
#elif WAVR_GRADIENT == 12
  return liquidGradient(uv, time);
#elif WAVR_GRADIENT == 13
  return softCellsGradient(uv, time);
#elif WAVR_GRADIENT == 14
  return grainflowGradient(uv, time);
#elif WAVR_GRADIENT == 15
  return prismGlassGradient(uv, time);
#elif WAVR_GRADIENT == 16
  return neonTunnelGradient(uv, time);
#else
#error Unknown WAVR_GRADIENT
#endif
}
