// Every gradient mode, each guarded so a layer program contains exactly one of
// them. The engine compiles the layer program with `#define WAVR_GRADIENT <id>`
// (ids: GRADIENT_TYPE_IDS in engine.ts). A new mode needs its own guard here and
// a branch in computeGradient() at the bottom.
//
// Every mode but image (an uploaded picture) is light: the light gradients read
// the palette as a ramp from shadow to light, the light fields read their stops
// as lights in linear light. House rules:
// - A few broad, slow forms. Fewer, wider features read as calm; many thin ones
//   read as noise and alias at 4K. Coordinates are aspect-corrected
//   (centeredUV) so forms stay round on any viewport.
// - A field goes to the palette through pingPong() (or a sine), never fract():
//   the palette runs back and forth and never jumps from its last colour to its
//   first.
// - Highlights and hot cores may burn toward white; nothing else adds white.
// - Pixel-scale detail is sized from the canvas height, so a 4x export is the
//   same picture, and nothing jumps in time.
// Mouse interaction is mouseWarp() in layer.glsl, not here.

// ============================================================
// Light gradients
// ============================================================
// Light on a surface or in the dark: a mirror, a film, a planet's limb, a leak,
// smoke, a glass orb. Their palette is a light ramp, from the deepest shadow (the
// first stop) to the brightest light (the last), so they need a palette that
// starts dark and ends light (their presets have one).

// liquidChrome: flowing mirror metal. A smooth, slow height field (domain-warped
// simplex, a few broad folds) lit as a perfect mirror: the surface normal reflects
// the view vector into a fake studio (dark floor, bright horizon strip, soft sky)
// whose tones are palette positions. The horizon strip snakes along the folds; a
// tight specular streak rides the crests.
#if WAVR_GRADIENT == 17
float chromeHeight(vec2 p, float time) {
  float f = 0.16 + 0.11 * u_complexity;
  time *= 0.35;
  vec2 q = p * f * vec2(0.8, 1.15);
  vec2 w = vec2(snoise(q * 0.9 + vec2(0.0, time * 0.05)),
                snoise(q * 0.9 + vec2(5.2, 1.3 - time * 0.04)));
  q += (0.25 + 1.0 * u_distortion) * w;
  float h = snoise(q + vec2(time * 0.04, 0.0));
  h += 0.18 * snoise(q * 1.8 + w * 0.6 + vec2(3.7, time * 0.06));
  return h / f;
}

float chromeBand(float y, float centre, float lo, float hi) {
  return smoothstep(centre - lo, centre, y) * (1.0 - smoothstep(centre, centre + hi, y));
}

// Studio environment along the reflected direction's elevation `y` (tilted
// horizon already folded in); returns a palette position (0 = darkest stop,
// 1 = lightest). `a` is the edge softness of the one hard edge.
float chromeStudio(float y, float rx, float a) {
  // overall vertical ramp: graphite floor, steel sky
  float base = 0.045 + 0.40 * pow(smoothstep(-1.0, 0.9, y), 1.35) + 0.06 * smoothstep(-0.5, 0.5, rx);
  // a dim floor-reflection strip
  float floorStrip = 0.20 * chromeBand(y, -0.42, 0.10, 0.16);
  // the horizon strip: hard lower edge, soft upper shoulder
  float strip = smoothstep(-0.02 - a, -0.02 + a, y) * (1.0 - smoothstep(0.04, 0.22, y));
  // a broad softbox overhead
  float box = chromeBand(y, 0.62, 0.20, 0.22) * smoothstep(-0.9, -0.2, rx) * 0.38;
  return clamp(mix(base + floorStrip + box, 1.0, strip), 0.0, 1.0);
}

// The studio box-filtered over the pixel's footprint in y (five taps), so edges
// that sweep past faster than a pixel blur instead of stitching.
float chromeEnv(vec3 r) {
  float y = r.y + 0.14 * r.x;
  float fw = fwidth(y);
  float a = 0.012 + 0.3 * fw + 0.30 * u_softness;
  float s = 0.0;
  for (int i = -2; i <= 2; i++) s += chromeStudio(y + float(i) * 0.3 * fw, r.x, a);
  return s * 0.2;
}
#endif

#if WAVR_GRADIENT == 17
vec3 liquidChromeGradient(vec2 uv, float time) {
  vec2 p = centeredUV(uv) * u_scale;
  float e = 0.006;
  float hx0 = chromeHeight(p - vec2(e, 0.0), time);
  float hx1 = chromeHeight(p + vec2(e, 0.0), time);
  float hy0 = chromeHeight(p - vec2(0.0, e), time);
  float hy1 = chromeHeight(p + vec2(0.0, e), time);
  vec2 g = vec2(hx1 - hx0, hy1 - hy0) / (2.0 * e);
  float relief = 0.8 + 0.8 * u_distortion;
  vec3 n = normalize(vec3(-g * relief, 1.0));
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 r = reflect(-v, n);
  float s = chromeEnv(r);
  vec3 col = getGradientColor(s);
  // tight specular streak from a key light (softness widens it toward satin)
  vec3 l = normalize(vec3(-0.45, 0.55, 0.7));
  float d = dot(n, normalize(l + v));
  float sc = mix(1.0 / 300.0, 1.0 / 30.0, u_softness);
  float sc2 = sc + 0.9 * fwidth(d);
  float spec = exp(-(1.0 - d) / sc2) * (sc / sc2);
  col += spec * getGradientColor(1.0);
  return col;
}
#endif

// iridescentFoil: holographic thin-film foil. A broad, gently folded metallised
// sheet reflecting a soft studio. The reflection is tinted by a thin film: the
// palette position is the film thickness (a slow field across the sheet) plus the
// viewing angle (the height of the reflected ray), so colour shifts across the
// folds along with the light instead of sitting on them.
#if WAVR_GRADIENT == 18
float foilHeight(vec2 p, float time) {
  float f = 0.14 + 0.08 * u_complexity;
  time *= 0.42;
  vec2 q = p * f * vec2(0.85, 1.1);
  vec2 w = vec2(snoise(q * 0.9 + vec2(0.0, time * 0.05)),
                snoise(q * 0.9 + vec2(5.2, 1.3 - time * 0.04)));
  q += (0.25 + 0.9 * u_distortion) * w;
  float h = snoise(q + vec2(time * 0.04, 0.0));
  h += 0.15 * snoise(q * 1.9 + w * 0.6 + vec2(3.7, time * 0.06));
  return h / f;
}

// Brightness of the soft studio along elevation y: dark floor, a bright
// horizon band with a crisp lower edge, a gently darker sky.
float foilStudio(float y, float a) {
  float floorTone = 0.04 + 0.22 * smoothstep(-0.9, -0.05, y);
  float band = smoothstep(-0.03 - a, -0.03 + a, y) * (1.0 - smoothstep(0.02, 0.5, y));
  float sky = 0.42 - 0.16 * smoothstep(0.2, 1.0, y);
  return clamp(mix(floorTone, sky, smoothstep(-0.03 - a, -0.03 + a, y)) + 0.62 * band, 0.0, 1.0);
}
#endif

#if WAVR_GRADIENT == 18
vec3 iridescentFoilGradient(vec2 uv, float time) {
  vec2 p = centeredUV(uv) * u_scale;
  float e = 0.006;
  float hx0 = foilHeight(p - vec2(e, 0.0), time);
  float hx1 = foilHeight(p + vec2(e, 0.0), time);
  float hy0 = foilHeight(p - vec2(0.0, e), time);
  float hy1 = foilHeight(p + vec2(0.0, e), time);
  vec2 g = vec2(hx1 - hx0, hy1 - hy0) / (2.0 * e);
  vec3 n = normalize(vec3(-g * (0.45 + 0.7 * u_distortion), 1.0));
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 r = reflect(-v, n);

  // soft studio, box-filtered over the pixel footprint like liquidChrome
  float y = r.y + 0.12 * r.x;
  float fw = fwidth(y);
  float a = 0.02 + 0.3 * fw + 0.30 * u_softness;
  float L = 0.0;
  for (int i = -2; i <= 2; i++) L += foilStudio(y + float(i) * 0.3 * fw, a);
  L = smoothstep(0.10, 0.85, L * 0.2);

  // thin film: thickness field + viewing angle, through a sine (no crease)
  float tau = 0.5 + 0.5 * snoise(p * 0.38 + vec2(2.0, time * 0.03));
  float phi = 2.0 * tau + 1.5 * clamp(y, -1.0, 1.0);
  vec3 film = getGradientColor(0.25 + 0.75 * (0.5 - 0.5 * cos(3.14159 * phi)));
  vec3 dark = getGradientColor(0.0);

  // the brightest part of the studio is pearl-white; film shows as it falls off,
  // and darker film is also deeper (saturated) rather than a muddy brown
  vec3 pearl = getGradientColor(1.0);
  vec3 tint = getGradientColor(0.25);
  vec3 deep = pow(mix(film, tint, 0.55 * (1.0 - L)), vec3(1.0 + 1.3 * (1.0 - L)));
  vec3 col = mix(dark, mix(deep, pearl, 0.35 * smoothstep(0.75, 1.0, L)), L);
  vec3 l = normalize(vec3(-0.45, 0.55, 0.7));
  float d = dot(n, normalize(l + v));
  float sc = mix(1.0 / 260.0, 1.0 / 30.0, u_softness);
  float sc2 = sc + 0.9 * fwidth(d);
  col += exp(-(1.0 - d) / sc2) * (sc / sc2) * mix(film, vec3(1.0), 0.7);
  return col;
}
#endif

// horizonGlow: a huge dark planet below the frame, lit along its upper limb by a
// thin crisp rim, with atmospheric scattering fading up into a dark sky.
// One evaluation per pixel: a planet SDF, three scale-height exponentials, one
// 3-octave fbm for the drifting variation, one hashed star cell.
#if WAVR_GRADIENT == 19
// Light -> colour. `i` is emitted light (can exceed 1). The palette runs from the
// sky's ink to the lightest stop; past the end it burns toward white.
vec3 horizonGlowTone(float i, float tint) {
  float t = pow(1.0 - exp(-i * 1.1), 1.18);
  vec3 c = getGradientColor(clamp(t + tint, 0.0, 1.0));
  vec3 hot = mix(getGradientColor(1.0), vec3(1.0), 0.7);
  return mix(c, hot, smoothstep(1.1, 3.4, i));
}

// A sparse field of faint, crisp stars. Cells are sized in pixels from
// u_resolution.y so a 4K export has the same stars, just sharper.
float horizonGlowStars(vec2 uv, float time) {
  float px = u_resolution.y / 540.0;
  float cellPx = 52.0 * px;
  vec2 g = uv * u_resolution / cellPx;
  vec2 cell = floor(g);
  vec2 h = hash22(cell + 31.7);
  float present = step(clamp(0.82 - 0.1 * u_complexity, 0.0, 0.9), hash(cell + 9.1));
  vec2 pos = 0.18 + 0.64 * h;
  vec2 d = (fract(g) - pos) * cellPx;
  float sigma = 0.6 * px;
  float core = exp(-dot(d, d) / (2.0 * sigma * sigma));
  float mag = pow(hash(cell + 3.3), 4.0);
  float twinkle = 0.8 + 0.2 * sin(time * 1.1 + h.x * 40.0);
  return present * core * (0.28 + 1.1 * mag) * twinkle;
}
#endif

#if WAVR_GRADIENT == 19
vec3 horizonGlowGradient(vec2 uv, float time) {
  // One "pixel" in canvas heights, as at 540 lines: crisp edges keep the same share
  // of the frame in a 4K export (and never get thinner than a device pixel).
  float px = max(1.0 / u_resolution.y, 1.0 / 540.0);
  vec2 p = centeredUV(uv);

  // The planet: top of the limb sits low in the frame, centre far below it.
  float R = 2.1 * u_scale;
  float topY = -0.20;
  vec2 c = vec2(0.0, topY - R);
  vec2 q = p - c;
  float d = length(q) - R;                          // + sky, - planet
  float s = atan(q.x, q.y) * R;                     // arc length along the limb, 0 = top

  // Where the sun sits on the limb: drifts slowly, never jumps.
  float s0 = 0.22 + 0.24 * sin(time * 0.23) + 0.06 * sin(time * 0.61 + 1.3);
  float along = (s - s0) / 0.85;
  float lit = exp(-along * along);                  // 1 at the bright spot
  float wide0 = exp(-pow(along * 0.5, 2.0));

  // Drifting variation inside the glow: clouds of scatter creeping along the limb.
  float wob = u_distortion;
  vec2 np = vec2(s * 1.7 - time * 0.16, d * 3.4 - time * 0.07);
  float n = fbm(np + vec2(0.0, 4.0), 3);
  // Plumes: the glow climbs higher in some stretches of the limb than others.
  float plume = snoise(vec2(s * 1.9 - time * 0.11, 5.0 + time * 0.045));
  float hgt = max(d, 0.0) * (1.0 + 0.35 * wob * n) / (1.0 + 0.9 * wob * plume * (0.3 + 0.7 * wide0))
            * (1.0 + 0.06 * sin(time * 0.31));

  // Atmospheric scattering: a tight inner layer, a mid one, a broad faint one.
  float spread = mix(0.85, 1.2, clamp(u_softness, 0.0, 1.0));
  float inner = exp(-hgt / (0.016 * spread));
  float mid = exp(-hgt / (0.072 * spread));
  float outer = exp(-hgt / (0.26 * spread));
  float wide = exp(-pow(along * 0.62, 2.0));
  // A halo around the sun's point on the limb: the one place the sky goes warm.
  vec2 sunP = c + R * vec2(sin(s0 / R), cos(s0 / R));
  float sd = length(p - sunP);
  float halo = exp(-sd * sd / 0.075) * 0.55 + exp(-sd / 0.07) * 0.35;
  // Airglow: a faint, thin veil riding parallel to the limb.
  float veil = exp(-pow((hgt - 0.05) / 0.011, 2.0)) * (0.10 + 0.08 * n) * (0.3 + 0.7 * wide);
  float atmos = veil + 0.80 * inner * (0.25 + 0.75 * lit)
              + 0.85 * mid * (0.22 + 0.78 * lit)
              + 0.62 * outer * (0.10 + 0.90 * wide)
              + halo * (0.6 + 0.4 * smoothstep(0.0, 0.1, d));
  atmos *= 1.0 + 0.7 * wob * n * (0.4 + 0.6 * lit);

  // The rim: a thin, crisp line right on the limb, strongest where the sun is.
  float aa = 1.1 * px;
  float rimW = mix(1.0, 2.4, clamp(u_softness, 0.0, 1.0)) * 1.15 * px;
  float skyMask = smoothstep(-aa, aa, d);
  float rimLine = exp(-max(d, 0.0) / rimW) * skyMask;
  float rim = rimLine * (0.18 + 3.4 * pow(lit, 1.3));

  // An anamorphic streak through the hot spot, hugging the limb.
  float streak = exp(-abs(d) / (3.5 * px)) * exp(-abs(s - s0) / 0.30) * 0.9 * lit;

  // Limb glow just inside the disc: the atmosphere seen edge-on.
  float limb = exp(-max(-d, 0.0) / (4.0 * px)) * (1.0 - skyMask) * lit * 0.5;
  // Faint earthshine on the planet body, deeper toward the limb.
  float body = (1.0 - skyMask) * exp(max(d, -0.4) / 0.11) * 0.05 * (0.4 + 0.6 * lit);

  float I = atmos * skyMask + rim + streak + limb + body;

  // Colour drifts with height and along the limb: cooler up, warmer at the sun.
  float tint = -0.06 * smoothstep(0.0, 0.6, d) + 0.05 * (lit - 0.5) + 0.07 * exp(-sd * sd / 0.12);
  vec3 col = horizonGlowTone(I, tint);

  // Stars, only in dark sky.
  float dark = 1.0 - smoothstep(0.015, 0.16, atmos);
  float stars = horizonGlowStars(uv, time) * skyMask * dark * smoothstep(0.0, 0.1, d);
  col += stars * mix(getGradientColor(1.0), vec3(1.0), 0.6);

  return col;
}
#endif

// lightLeak: a near-black frame with warm light bleeding in over the film edge.
// The big leak off the right edge is a curtain of light hugging the border (its
// depth and brightness torn by slow 1D noise along the edge, so it pushes in as
// ragged tongues) with a hot, horizontally stretched (anamorphic) core on it; a
// smaller leak sits past the lower-left corner. The plane is domain-warped by
// slow smooth noise so every boundary is organic. The core burns out toward the
// palette's lightest stop inside a crimson halation skirt, and one crisp, level
// anamorphic line runs through it. Made for heavy film grain (its presets set
// it). Two snoise for the warp, two for the curtain, one 3-octave fbm, one smear
// snoise, a handful of exp(); the light is summed and tone-mapped through the
// palette like a heat ramp.
#if WAVR_GRADIENT == 20
vec2 lightLeakWarp(vec2 p, float time) {
  return vec2(snoise(p * 1.25 + vec2(time * 0.045, 3.0)),
              snoise(p * 1.25 + vec2(8.0, -time * 0.04)));
}

// One stretched lobe: core, body and skirt of light around `centre`.
float lightLeakLobe(vec2 p, vec2 centre, vec2 stretch, float tilt) {
  vec2 d = p - centre;
  float c = cos(tilt);
  float s = sin(tilt);
  vec2 e = vec2(c * d.x - s * d.y, s * d.x + c * d.y) / stretch;
  float r = length(e);
  float hot = 2.3 * exp(-pow(r / 0.14, 1.8));
  float body = 0.95 * exp(-pow(r / 0.34, 1.25));
  float skirt = 0.12 * exp(-r / 0.80);
  return hot + body + skirt;
}
#endif

#if WAVR_GRADIENT == 20
vec3 lightLeakGradient(vec2 uv, float time) {
  float aspect = u_resolution.x / u_resolution.y;
  // One "pixel" in canvas heights, as at 540 lines: the crisp line keeps the same
  // share of the frame in a 4K export (and never gets thinner than a device pixel).
  float px = max(1.0 / u_resolution.y, 1.0 / 540.0);
  vec2 p = centeredUV(uv);
  float wobAmt = 0.45 + 1.1 * u_distortion;
  float S = u_scale;

  // Smooth domain warp: organic, slowly drifting boundaries (no spikes).
  vec2 pw = p + 0.15 * wobAmt * lightLeakWarp(p, time);
  // A coarser field makes the light swell and recede in patches.
  float leakPatch = fbm(p * 0.9 + vec2(-time * 0.04, time * 0.03) + 11.0, 3);

  float edge = 0.5 * aspect;
  float swellA = 1.0 + 0.10 * sin(time * 0.33) + 0.05 * sin(time * 0.87 + 1.0);
  float yA = 0.24 + 0.06 * sin(time * 0.21);
  vec2 cA = vec2(edge + 0.05, yA);

  // The curtain: light hugging the right border, deeper and brighter in some
  // stretches than others (1D noise along the edge), always strongest at the edge.
  float inward = max(edge - pw.x, 0.0);
  float n1 = snoise(vec2(pw.y * 2.6 + 2.0, time * 0.05));
  float n2 = snoise(vec2(pw.y * 5.5 - 6.0, time * 0.07));
  float depth = (0.16 + 0.20 * (0.5 + 0.5 * n1)) * S;
  float strength = 0.34 + 0.50 * (0.5 + 0.5 * n2);
  float curtain = strength * exp(-pow(inward / depth, 0.85)) * (0.70 + 0.30 * smoothstep(-0.9, 0.3, -abs(pw.y - 0.05)));

  // Leak A: the hot core on the curtain, with an amber lobe below and a redder
  // one high up.
  float I = swellA * (
      1.05 * lightLeakLobe(pw, cA, vec2(0.80, 0.44) * S, 0.06)
    + 0.46 * lightLeakLobe(pw, vec2(edge + 0.10, -0.26 + 0.05 * sin(time * 0.17 + 2.0)), vec2(0.66, 0.28) * S, -0.18)
    + 0.34 * lightLeakLobe(pw, vec2(edge - 0.02, 0.74), vec2(0.50, 0.22) * S, 0.25)
    + curtain);

  // Leak B: past the lower-left corner, smaller and redder, out of phase.
  float swellB = 1.0 + 0.12 * sin(time * 0.29 + 2.4);
  I += swellB * (
      0.70 * lightLeakLobe(pw, vec2(-edge - 0.05, -0.56), vec2(0.90, 0.50) * S, -0.35)
    + 0.26 * lightLeakLobe(pw, vec2(-edge - 0.12, -0.12), vec2(0.56, 0.28) * S, 0.2));

  I *= 0.9 + 0.22 * (0.5 + 0.5 * leakPatch);
  // Light dragged sideways through the lens: soft level streaks across the whole
  // leak (blurred, never hairline), strongest where the light is.
  float drag = snoise(vec2(p.x * 1.1 + 5.0, p.y * 14.0 + time * 0.05));
  I *= 1.0 + 0.055 * drag * smoothstep(0.05, 0.6, I);

  // Where the main core really lands on screen (the warp has pushed it): the
  // straight optical line is laid on that point, un-warped, as a lens would.
  vec2 core = cA - 0.15 * wobAmt * lightLeakWarp(cA, time);
  vec2 dc = p - core;
  float reachA = max(-dc.x, 0.0);
  float inFrame = smoothstep(0.0, 0.03, edge - p.x);

  // Streak: a short soft smear plus one crisp, perfectly level anamorphic line.
  float sn = snoise(vec2(dc.y * 15.0 + 7.0, time * 0.07));
  float smear = pow(0.5 + 0.5 * sn, 3.0);
  I += smear * 0.20 * exp(-reachA / 0.20) * exp(-pow(dc.y / 0.28, 2.0)) * inFrame;
  I += 1.2 * exp(-pow(dc.y / (1.1 * px), 2.0)) * exp(-reachA / 0.40) * inFrame;

  // Film base fog.
  I += 0.006;

  // Light through a heat ramp: black, plum, crimson, orange, amber, cream; past
  // that it burns out to white. The curve keeps faint light near black so most of
  // the frame stays negative space.
  float t = pow(1.0 - exp(-I * 1.15), 1.3);
  vec3 col = getGradientColor(clamp(t, 0.0, 1.0));
  vec3 hot = mix(getGradientColor(1.0), vec3(1.0), 0.55);
  col = mix(col, hot, smoothstep(1.7, 4.2, I));
  return col;
}
#endif

// inkSmoke: a plume of ink or incense smoke in dark water. Fine strands leave a
// point at the lower left and fan out as they rise; the whole plume is read at
// a point carried along a curl (divergence-free) flow whose strength grows with
// height, so the strands start straight and end up folding, curling and
// shearing like something advected, not like cloud fbm. Soft veils and darker
// sheets sit in the same flow for depth.
// Palette convention: stop 0 = the water, the last stop = the brightest strand.
#if WAVR_GRADIENT == 21
// Curl of a scalar noise potential: a velocity field with no sources or sinks.
vec2 inkSmokeCurl(vec2 q) {
  float e = 0.06;
  float n0 = snoise(q);
  float nx = snoise(q + vec2(e, 0.0));
  float ny = snoise(q + vec2(0.0, e));
  return vec2(ny - n0, -(nx - n0)) / e;
}

// Carry the point p along the flow: big slow eddies first, then smaller ones.
vec2 inkSmokeAdvect(vec2 p, float time, float amount) {
  float h = smoothstep(-0.55, 0.55, p.y);
  float a = amount * (0.12 + 0.88 * h);
  vec2 q = p;
  q.x += 0.04 * sin(p.y * 2.6 + time * 0.35) * (0.3 + h);
  q += a * 0.17 * inkSmokeCurl(q * 1.1 + vec2(1.3, time * 0.05));
  q += a * 0.045 * inkSmokeCurl(q * 2.2 + vec2(7.1, -time * 0.07) + 3.0);
  q += a * 0.012 * inkSmokeCurl(q * 4.6 + vec2(-2.4, 5.5 + time * 0.09));
  return q;
}
#endif

#if WAVR_GRADIENT == 21
vec3 inkSmokeGradient(vec2 uv, float time) {
  vec2 p = centeredUV(uv) * u_scale;
  float cx = clamp((u_complexity - 1.0) / 6.0, 0.0, 1.0);
  float amount = 0.40 + 1.2 * u_distortion;

  vec2 q = inkSmokeAdvect(p, time, amount);

  // The plume's spine runs from a source at the lower left up and to the right;
  // strands fan out from it with height.
  float hq = clamp(q.y + 0.60, 0.0, 1.8);
  float spread = 0.10 + 0.90 * smoothstep(0.0, 1.3, hq);
  float spine = -0.50 + 0.55 * pow(hq, 1.15);
  float r = (q.x - spine) / spread;

  // Strands: thin lines at whole numbers of r, each with its own brightness
  // and its own stretches of life along its length.
  float Fs = 4.5 + 3.5 * cx;
  float sx = r * Fs;
  float id = floor(sx + 0.5);
  float d = abs(sx - id);
  float fwx = max(fwidth(sx), 1e-4);
  float thick = 0.5 + 0.5 * snoise(vec2(id * 1.7, q.y * 0.7));
  float wpx = mix(0.7, 1.9, thick);
  float line = exp(-(d / (fwx * wpx)) * (d / (fwx * wpx)));
  float hw = min(0.09 + 3.0 * fwx, 0.22);
  float halo = exp(-(d / hw) * (d / hw)) * 0.34;
  // Strands closer than a few pixels blur into one soft band instead of aliasing.
  float vis = 1.0 - smoothstep(0.12, 0.34, fwx);
  line = mix(0.30, line, vis);
  halo = mix(0.30, halo, vis);
  // A wide, faint sheet around each strand: where strands crowd these merge into smoke.
  // (its strength varies smoothly across strands, so no seam where one strand hands over to the next)
  float wideAmp = 0.25 + 0.75 * smoothstep(-0.3, 0.6, snoise(vec2(sx * 0.42, q.y * 0.9 + time * 0.03)));
  float wide = exp(-(d / 0.40) * (d / 0.40)) * wideAmp;
  float hid = hash(vec2(id, 7.3));
  float life = smoothstep(-0.30, 0.50, snoise(vec2(id * 3.7, q.y * 1.1 + time * 0.04)) + 0.25 * snoise(vec2(id * 1.3, q.y * 3.1)));
  float strand = (line + halo) * (0.25 + 0.75 * hid * hid) * life;
  // The plume thins out at its flanks and at the top.
  float flank = exp(-pow(abs(r) / 1.15, 2.4));
  float tip = 1.0 - smoothstep(0.85, 1.55, hq);
  float strandLight = strand * flank * (0.35 + 0.65 * tip);
  float smoke = wide * flank * (0.3 + 0.7 * tip);

  // Veils: soft translucent sheets stretched along the flow, and darker sheets.
  float vA = snoise(vec2(r * 0.9, q.y * 0.55) + vec2(4.0, time * 0.02));
  float vB = snoise(vec2(r * 2.0, q.y * 1.2) + vec2(0.0, 9.0));
  float veil = smoothstep(-0.2, 0.8, vA * 0.7 + vB * 0.3) * flank * (0.3 + 0.7 * tip);
  float darkSheet = smoothstep(0.0, 0.7, snoise(vec2(r * 1.2, q.y * 0.8) + vec2(-5.0, 2.0)));

  vec3 water = mix(getGradientColor(0.0), getGradientColor(0.07), smoothstep(0.5, -0.5, p.y));
  vec3 col = water;
  col += getGradientColor(0.18 + 0.42 * veil) * pow(veil, 1.4) * (1.0 - 0.55 * darkSheet) * 1.5;
  col += getGradientColor(0.22 + 0.45 * smoke) * smoke * (1.0 - 0.6 * darkSheet) * 1.15;
  float b = clamp(strandLight * 1.6, 0.0, 1.4);
  col += getGradientColor(0.40 + 0.60 * clamp(b, 0.0, 1.0)) * b * (1.0 - 0.35 * darkSheet) * 1.7;
  return col;
}
#endif

// plasmaOrb: a soft round glow in a dark room, like light through a diffuser.
// Inside a gaussian body seven broad gaussian blobs drift on slow sines, each
// carrying its own colour from the palette; their colours are averaged in linear
// light, weighted by the blobs, so neighbouring lobes melt into each other as
// light does instead of stacking. The body's tail and a faint wide glow fade into
// a room lit by the first stop. There is no rim and no highlight: the edge is a
// falloff.
#if WAVR_GRADIENT == 22
// The melted blob colour at q (in orb radii), in linear light.
vec3 plasmaOrbField(vec2 q, float time) {
  q += u_distortion * 0.35 * vec2(snoise(q * 0.6 + vec2(0.0, time * 0.02)),
                                  snoise(q * 0.6 + vec2(5.2, 1.3 - time * 0.02)));
  float width = mix(0.8, 0.48, (u_complexity - 1.0) / 9.0);
  vec3 acc = vec3(0.0);
  float sum = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 ha = hash22(vec2(fi, 1.7));
    vec2 hb = hash22(vec2(fi, 4.3));
    vec2 hc = hash22(vec2(fi, 8.9));
    // Angular rates under 0.15: every period is over 40 s at speed 1.
    vec2 c = 0.7 * vec2(sin(time * (0.06 + 0.08 * ha.x) + 6.283 * ha.y),
                        cos(time * (0.05 + 0.08 * hb.x) + 6.283 * hb.y));
    float s = width * (0.85 + 0.3 * hc.x);
    vec2 d = q - c;
    float w = exp(-dot(d, d) / (s * s));
    // Palette places spread over the upper stops, in no order, so lobes of
    // different colours sit side by side.
    acc += w * srgbToLinear(getGradientColor(pingPong(0.3 + 0.7 * fract(fi * 0.43))));
    sum += w;
  }
  // Dimmed smoothly where the blobs thin out, so the body's outline stays soft
  // and drifts with them; far out, where the weights underflow, it goes to 0.
  return acc / max(sum, 1e-3) * (1.0 - exp(-2.0 * sum));
}
#endif

#if WAVR_GRADIENT == 22
vec3 plasmaOrbGradient(vec2 uv, float time) {
  vec2 p = centeredUV(uv);
  float R = 0.33 * u_scale * (1.0 + 0.015 * sin(time * 0.5));
  vec2 q = p / R;
  float r2 = dot(q, q);
  float body = exp(-mix(2.0, 0.8, u_softness) * r2);
  vec3 light = plasmaOrbField(q, time) * body * 2.2
             + srgbToLinear(getGradientColor(0.5)) * 0.25 * exp(-sqrt(r2 + 0.05))
             + srgbToLinear(getGradientColor(0.0)) * 0.06;
  // A gentle shoulder: bright lobes stay saturated rather than turning white.
  light /= 1.0 + 0.25 * max(max(light.r, light.g), light.b);
  return linearToSrgb(min(light, vec3(1.0)));
}
#endif

// ============================================================
// Light fields
// ============================================================
// Coloured light in a space, after light installations: an opening of light in
// a wall, a luminous ring in the dark, a backlit wall. These add light rather
// than walk a palette: they work in linear light, where light sums, blurs and
// spills as it does in a room (common.glsl, "Light"), and every glow is in
// closed form (blurredBox(), exponentials) rather than a blur pass, so it is
// exact at any radius and the code exports carry it. Stops mix in linear light
// too (two lights overlapping), whatever the Oklab switch says. The result
// reaches the display through lightToDisplay(), where light past white bleaches
// toward white, so like the light gradients these may burn toward white.

// Aperture: a knife-edged opening in a wall, filled with light. The first stop
// is the wall; the others are the light in the opening, from its deep core
// (stop 1) out to its rim (the last stop), so the light seems to come from the
// edges: pale where they are, deepening to a saturated core. Softness widens
// the passage from rim to core. Distortion is the haze in the room: it softens
// and rounds the opening and spills its light onto the wall. Complexity sets
// the proportions (a tall slit at 1, square at 4, a wide band at 8) and scale
// the size. The light breathes and drifts, slowly; the opening stays put.
#if WAVR_GRADIENT == 23
// Width over height of the opening: 0.42 at complexity 1, 1 at 4, 3.2 at 8.
float apertureAspect() {
  return exp2((clamp(u_complexity, 1.0, 8.0) - 4.0) * 0.42);
}

// The light at depth `k` into the opening: 0 on the rim (the last stop), 1 in
// the core (stop 1).
vec3 apertureLight(float k) {
  int last = max(u_colorCount - 1, 0);
  int first = min(1, last);
  return lightStops(mix(float(last), float(first), clamp(k, 0.0, 1.0)), first, last);
}

// min(a, b), rounded where they are within about k of each other.
float apertureSmin(float a, float b, float k) {
  return min(a, b) - k * log(1.0 + exp(-abs(a - b) / k));
}
#endif

#if WAVR_GRADIENT == 23
vec3 apertureGradient(vec2 uv, float time) {
  float px = 1.0 / u_resolution.y;
  vec2 p = centeredUV(uv);
  float haze = clamp(u_distortion, 0.0, 1.0);
  float soft = clamp(u_softness, 0.0, 1.0);

  vec2 halfSize = vec2(apertureAspect(), 1.0) * 0.32 * u_scale;
  float minHalf = min(halfSize.x, halfSize.y);

  // The opening: a knife edge, anti-aliased over about a pixel. Haze softens
  // and rounds it, as fog does an edge seen through it.
  float d = sdRoundedBox(p, halfSize, minHalf * 0.45 * haze * haze);
  float edgeSigma = 0.6 * px + 0.012 * haze;
  float open = 0.5 - 0.5 * erfApprox(d / (1.41421 * edgeSigma));

  // Light comes in from every edge and falls off exponentially into the
  // opening, so near a corner the light of two edges adds up: the corners run
  // pale and the iso-lines round off. `depth` is how deep a point sits in that
  // light (the two edges' depths smoothly combined; negative in a corner lit
  // from both sides). Softness lengthens the falloff: at 1 the colour follows
  // the light itself, from the rim stop at the edge toward the core; at 0 the
  // rim holds its colour, then turns to the core over a short passage.
  float breathe = 0.6 * sin(time * 0.21) + 0.4 * sin(time * 0.13 + 1.7);
  vec2 drift = 0.09 * minHalf * vec2(sin(time * 0.17), cos(time * 0.11 + 0.6));
  vec2 inset = halfSize - abs(p - drift);
  float lambda = mix(0.06, 0.34, soft) * minHalf * (1.0 + 0.28 * breathe);
  float depth = apertureSmin(inset.x, inset.y, lambda);
  float rim = mix(0.36, 0.3, soft) * minHalf * (1.0 + 0.22 * breathe);
  float crisp = smoothstep(rim - 0.07 * minHalf, rim + 0.07 * minHalf, depth);
  float falloff = 1.0 - exp(-max(depth, 0.0) / lambda);
  vec3 light = apertureLight(mix(crisp, falloff, smoothstep(0.1, 0.9, soft)));
  // The lip runs a little hot, and a corner lit from both sides hotter still;
  // lightToDisplay pales them toward white.
  light *= 1.0 + 0.1 * exp(-abs(depth) / (0.02 * minHalf)) + 0.6 * clamp(-depth / lambda, 0.0, 1.0);
  // ...and the whole field glows a little brighter and dimmer, slowly.
  light *= 1.0 + 0.07 * sin(time * 0.29 + 0.8);

  // The wall, falling off a little toward the corners of the frame (a room,
  // not a flat card).
  vec2 v = p / vec2(0.5 * u_resolution.x / u_resolution.y, 0.5);
  vec3 wall = srgbToLinear(u_colors[0]) * (1.0 - 0.1 * smoothstep(0.3, 1.6, dot(v, v)));
  vec3 col = lightToDisplay(mix(wall, light * framePeak(), open));

  // Haze scatters the opening's light into the room: around it the wall takes
  // on its colour (a mix, not an addition, so pink light in a cyan room turns
  // the wall around it violet), and in front of it the light is veiled a
  // little. The glow is the exact blur of the opening, normalised to its middle
  // and wider along the opening's long side, as in a lit fog.
  vec2 spread = (0.9 * halfSize + 0.08) * mix(0.35, 1.0, haze);
  float glow = blurredBox(p, halfSize, spread) / blurredBox(vec2(0.0), halfSize, spread);
  vec3 mean = lightToDisplay(mix(apertureLight(1.0), apertureLight(0.0), 0.35) * framePeak());
  return mix(col, mean, haze * mix(0.82 * min(glow, 1.0), 0.3, open));
}
#endif

// Halo: a loop of light hanging in a dark, hazy room, seen from a little above,
// so it reads as an ellipse. The palette is a light ramp: the room (first stop),
// the haze, the glow, the hot core (last). A thin luminous ring is brightest
// where we look along it, at the two ends of the ellipse (limb brightening:
// the light per unit of screen length is 1 / sqrt(sin^2 + cos^2 tilt cos^2) of
// the angle round it), so the ends burn white. Around the line, a glow and a
// wide haze; the glow is dispersed (red reaches a little further out than blue)
// so the edges fringe like light through glass, and the near, lower arc is
// softer and warmer than the far one. Fine vertical striations cross the glow,
// as a spinning blade of LEDs leaves them in a long exposure, faded out before
// they would alias. Complexity adds fainter echo loops (two from 3, three from
// 6), distortion lets the loop sway out of round, softness widens the glow.
#if WAVR_GRADIENT == 24
// A soft profile across the line: Gaussian near the middle, a gentler tail.
float haloProfile(float d, float w) {
  float x = abs(d) / w;
  return exp(-x * x * 0.7 - x * 0.3);
}

// One loop. Returns the core line and the glow (each r g b: red sits a little
// outside blue, so the edges fringe) through `core` and `glow`; x = the haze,
// y = how far inside the loop the point is (0..1), z = how far toward the
// near, out-of-focus arc. `blur` widens everything (the echo loops are out of
// focus).
vec3 haloLoop(vec2 p, float a, float cosTilt, float time, float soft, float wobble, float blur,
              float px, out vec3 core, out vec3 glow) {
  float b = a * cosTilt;
  vec2 q = p / vec2(a, b);
  float r = length(q) + 1e-5;
  vec2 dir = q / r;
  float onLoop = smoothstep(0.3, 0.9, r);  // 0 in the middle, where the direction means nothing
  // Sway: the loop bends out of round by a slow noise read on the unit circle,
  // so there is no seam where the angle wraps.
  float target = 1.0 + 0.08 * wobble * snoise(dir * 0.9 + vec2(time * 0.07, 3.0 - time * 0.05));
  // Signed distance to the swaying ellipse in canvas heights, positive outside:
  // to first order (the radial excess over the gradient of r) near the loop,
  // easing toward the middle to a measure that doesn't depend on direction
  // (the first-order one jumps there).
  float d = (r - target) * mix(b, 1.0 / length(dir / vec2(a, b)), onLoop);
  float s = dir.y;
  float c = dir.x;
  // Limb brightening, and an emission that drifts slowly round the loop; both
  // eased out toward the middle, where the angle round the loop means nothing.
  float limb = mix(1.0, 1.0 / sqrt(s * s + cosTilt * cosTilt * c * c), onLoop);
  float ang = atan(dir.y, dir.x);
  float emit = 0.75 + 0.25 * onLoop * sin(ang + time * 0.23) * sin(ang * 2.0 - time * 0.11 + 1.0);
  // The near (lower) arc is out of focus: wider, dimmer and warmer.
  float near = smoothstep(0.1, -0.9, s) * onLoop;
  float defocus = blur * (1.0 + 1.1 * near);
  float coreW = max(mix(0.008, 0.014, soft) * defocus, 1.2 * px);
  float glowW = mix(0.034, 0.06, soft) * defocus;
  // Dispersion belongs to the loop in focus; the echoes are just soft light.
  float shift = (0.006 + 0.006 * soft) * defocus / (blur * blur);
  float energy = limb * emit / defocus;
  core = vec3(haloProfile(d - 0.4 * shift, coreW), haloProfile(d, coreW), haloProfile(d + 0.4 * shift, coreW))
       * energy * limb;
  glow = vec3(haloProfile(d - shift, glowW), haloProfile(d, glowW), haloProfile(d + shift, glowW)) * energy;
  float haze = haloProfile(d, mix(0.055, 0.09, soft) * sqrt(blur)) * mix(limb, 1.0, 0.5) * emit;
  return vec3(haze, smoothstep(0.02, -0.08, d) * (0.55 + 0.45 * r), near);
}
#endif

#if WAVR_GRADIENT == 24
vec3 haloGradient(vec2 uv, float time) {
  float px = 1.0 / u_resolution.y;
  vec2 p = centeredUV(uv) - vec2(0.0, 0.01 * sin(time * 0.17));
  float soft = clamp(u_softness, 0.0, 1.0);
  float wobble = 0.15 + 0.85 * clamp(u_distortion, 0.0, 1.0);
  float a = 0.31 * u_scale;
  int loops = 1 + int(u_complexity >= 3.0) + int(u_complexity >= 6.0);

  vec3 col = lightRamp(0.0);
  vec3 hazeCol = lightRamp(0.58);
  vec3 innerCol = lightRamp(0.45);
  vec3 glowCol = lightRamp(0.8);
  vec3 coreCol = lightRamp(1.0);

  // Striations: about 110 per canvas height, so the same in a 4x export, and
  // faded out where they would come closer than about 4 pixels.
  float sx = (p.x + 0.003 * sin(p.y * 37.0 + time * 0.3)) * 110.0 + time * 0.4;
  float stripes = cos(6.28318 * sx) * (1.0 - smoothstep(0.2, 0.32, fwidth(sx)));

  for (int i = 0; i < 3; i++) {
    if (i >= loops) break;
    float fi = float(i);
    // Echo loops: higher up, more open, tilted, softer and fainter.
    float tiltAngle = 0.06 * fi * sin(time * 0.13 + fi);
    mat2 rot = mat2(cos(tiltAngle), sin(tiltAngle), -sin(tiltAngle), cos(tiltAngle));
    vec2 lp = rot * (p - vec2(0.0, 0.06 * fi));
    float cosTilt = (0.34 + 0.05 * sin(time * 0.19 + fi * 2.0)) * (1.0 + 0.3 * fi);
    vec3 core;
    vec3 glow;
    vec3 l = haloLoop(lp, a * (1.0 + 0.05 * fi), cosTilt, time + fi * 7.0, soft, wobble, 1.0 + 2.0 * fi, px, core, glow);
    float weight = (i == 0 ? 1.0 : 0.22 / fi) * framePeak();
    // Striations on the main loop only, where its far arc is in focus.
    float striated = i == 0 ? 1.0 + 0.45 * stripes * clamp(glow.g * 1.5, 0.0, 1.0) * clamp(1.0 + lp.y / (0.3 * a), 0.0, 1.0) : 1.0;
    col += weight * (
        hazeCol * l.x * 0.2
      + innerCol * l.y * 0.11
      + mix(glowCol, hazeCol, max(min(fi, 1.0) * 0.6, l.z)) * glow * 0.5 * striated
      + coreCol * core * 0.9 * striated);
  }
  return lightToDisplay(col);
}
#endif

// Light wall: coloured light seen through a wall of frosted glass panels. The
// first stop is the glass's own glow; each other stop lights soft, wide clouds
// behind the glass that drift sideways past each other and breathe. They add
// as light does, so where clouds overlap the wall burns pale. The panels meet
// at hairline seams (the same share of the frame in a 4x export, never
// thinner than a pixel) and each lets through a slightly different amount of
// light. Complexity adds clouds, softness makes
// them larger and vaguer, distortion bends them out of round, scale zooms the
// wall, panels included.
#if WAVR_GRADIENT == 25
vec3 lightWallGradient(vec2 uv, float time) {
  float px = 1.0 / u_resolution.y;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = centeredUV(uv) / u_scale;
  float soft = clamp(u_softness, 0.0, 1.0);
  float warp = clamp(u_distortion, 0.0, 1.0);
  int last = max(u_colorCount - 1, 0);
  int lights = max(last, 1);

  // The light behind the glass, bent by slow noise stretched along the wall so
  // the clouds are not ellipses.
  vec2 q = p + (0.06 + 0.22 * warp) * vec2(
    snoise(p * vec2(0.55, 1.5) + vec2(time * 0.03, 1.0)),
    0.5 * snoise(p * vec2(0.45, 1.3) + vec2(4.0, -time * 0.025)));
  vec3 light = srgbToLinear(u_colors[0]) * 0.5;
  int n = clamp(int(u_complexity) + 4, 5, 12);
  float size = mix(0.1, 0.2, soft);
  // Clouds wrap round a strip wider than the frame, fading out before they
  // reach its ends, so none appears or vanishes in sight.
  float span = aspect / u_scale + 3.0;
  for (int i = 0; i < 12; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 h = hash22(vec2(fi, 3.7));
    float dir = mod(fi, 2.0) < 1.0 ? 1.0 : -0.7;
    float x = mod(h.x * span + time * (0.025 + 0.03 * h.y) * dir, span) - 0.5 * span;
    float y = (h.y - 0.5) * 0.8 + 0.06 * sin(time * 0.11 + fi * 1.7);
    // Long, low clouds (light smeared along the wall), each with a hot core.
    vec2 d = (q - vec2(x, y)) / (size * vec2(3.0 + 2.5 * hash(vec2(fi, 5.3)), 1.0));
    float r2 = dot(d, d);
    float breathe = (0.75 + 0.25 * sin(time * 0.23 + fi * 2.3)) * smoothstep(0.5 * span, 0.5 * span - 1.2, abs(x));
    vec3 c = srgbToLinear(u_colors[min(1 + i % lights, last)]);
    light += c * (exp(-r2) + 0.8 * exp(-r2 * 4.0)) * (0.5 + 0.7 * hash(vec2(fi, 9.1))) * breathe;
  }
  // Streaks along the wall, as light carried behind a diffuser smears.
  light *= 1.0 + 0.22 * snoise(vec2(q.x * 0.7 + time * 0.02, q.y * 6.0 + 2.0)) * (0.4 + 0.6 * soft);

  // The panels: each transmits a little more or less, and darkens a touch
  // toward its edges; a hairline seam where two meet.
  float panelW = 0.44;
  float xp = p.x / panelW + 0.5;
  float id = floor(xp);
  float edge = min(fract(xp), 1.0 - fract(xp)) * panelW * u_scale;
  float seamW = max(0.0011, 0.7 * px);
  float seam = exp(-(edge / seamW) * (edge / seamW));
  light *= (0.96 + 0.08 * hash(vec2(id, 1.3))) * (0.95 + 0.05 * smoothstep(0.0, 0.08, edge));
  light *= 1.0 - 0.5 * seam;
  return lightToDisplay(light * framePeak());
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
#elif WAVR_GRADIENT == 8
  return imageGradient(uv, time);
#elif WAVR_GRADIENT == 17
  return liquidChromeGradient(uv, time);
#elif WAVR_GRADIENT == 18
  return iridescentFoilGradient(uv, time);
#elif WAVR_GRADIENT == 19
  return horizonGlowGradient(uv, time);
#elif WAVR_GRADIENT == 20
  return lightLeakGradient(uv, time);
#elif WAVR_GRADIENT == 21
  return inkSmokeGradient(uv, time);
#elif WAVR_GRADIENT == 22
  return plasmaOrbGradient(uv, time);
#elif WAVR_GRADIENT == 23
  return apertureGradient(uv, time);
#elif WAVR_GRADIENT == 24
  return haloGradient(uv, time);
#elif WAVR_GRADIENT == 25
  return lightWallGradient(uv, time);
#else
#error Unknown WAVR_GRADIENT
#endif
}
