// Every gradient mode, each guarded so a layer program contains exactly one of
// them. The engine compiles the layer program with `#define WAVR_GRADIENT <id>`
// (ids: GRADIENT_TYPE_IDS in engine.ts). A new mode needs its own guard here and
// a branch in computeGradient() at the bottom.

// ============================================================
// Gradient Modes — each with physics-matched mouse interaction
// ============================================================


#if WAVR_GRADIENT == 0
vec3 meshGradient(vec2 uv, float time) {
  // Mesh: fluid displacement — mouse pushes colors like water
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = fluidDisplace(p, u_mouseReact);
  }
  p *= u_scale;
  int octaves = int(u_complexity);

  // Layered fBm with velocity-influenced turbulence
  float velMag = length(u_mouseVelocity) * u_mouseReact * 0.004;
  float warp = u_distortion + u_domainWarp * 0.5;
  float n1 = fbm(p + vec2(time * 0.3, time * 0.2), octaves);
  float n2 = fbm(p + vec2(n1 * warp + time * 0.1 + velMag, n1 * warp - time * 0.15), octaves);
  float n3 = fbm(p + vec2(n2 * warp * 0.8 + velMag * 0.5, n2 * warp * 0.8 + time * 0.05), octaves);
  // Extra warping layers when domain warp is active
  float colorVal;
  if (u_domainWarp > 0.01) {
    float n4 = fbm(p + vec2(n3 * warp * 0.6 + time * 0.03, n3 * warp * 0.6 - time * 0.07), octaves);
    float n5 = fbm(p + vec2(n4 * warp * 0.4, n4 * warp * 0.4 + time * 0.02), octaves);
    colorVal = mix(n3, n5, u_domainWarp) * 0.5 + 0.5;
  } else {
    colorVal = n3 * 0.5 + 0.5;
  }
  return getGradientColor(colorVal);
}
#endif

#if WAVR_GRADIENT == 1
vec3 radialGradient(vec2 uv, float time) {
  // Radial: ripple waves emanate from mouse position
  vec2 center = vec2(0.5);
  vec2 p = (uv - center) * u_scale;
  float dist = length(p);
  float angle = atan(p.y, p.x);

  // Mouse creates ripple interference — multiple rings, speed-responsive
  float mouseRipple = 0.0;
  if (u_mouseReact > 0.0) {
    mouseRipple = rippleEffect(uv, time) * u_mouseReact * (u_distortion + 0.3);
    // Second harmonic ripple for richness
    float dist2 = length(uv - u_mouseSmooth);
    mouseRipple += sin(dist2 * 35.0 - time * 7.0) * smoothstep(0.6, 0.0, dist2) * u_mouseReact * 0.2;
  }

  float wave = sin(dist * u_complexity * 3.14159 - time * 2.0 + angle * 2.0) * u_distortion;
  float n = fbm(vec2(dist + wave + mouseRipple, angle + time * 0.2) * 2.0, int(u_complexity));

  float colorVal = dist + n * u_distortion + mouseRipple * 0.7;
  colorVal = fract(colorVal);
  return getGradientColor(colorVal);
}
#endif

#if WAVR_GRADIENT == 2
vec3 linearGradient(vec2 uv, float time) {
  // Linear: magnet pull warps the gradient toward cursor
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = magnetDisplace(p, u_mouseReact);
  }
  p *= u_scale;

  float base = p.x + p.y * 0.5;
  float wave = sin(p.y * u_complexity * 2.0 + time * 1.5) * u_distortion * 0.3;
  float n = fbm(p + vec2(time * 0.2, 0.0), int(u_complexity)) * u_distortion;

  float colorVal = fract(base + wave + n);
  return getGradientColor(colorVal);
}
#endif

#if WAVR_GRADIENT == 3
vec3 conicGradient(vec2 uv, float time) {
  // Conic: vortex swirl at mouse — spins the whole gradient
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    // Double-apply: vortex swirl + gravity lens for dramatic rotation
    p = vortexDisplace(p, u_mouseReact);
    p = gravityDisplace(p, u_mouseReact * 0.5);
  }

  vec2 center = vec2(0.5);
  vec2 pp = (p - center) * u_scale;
  float angle = atan(pp.y, pp.x) / 6.28318 + 0.5;
  float dist = length(pp);

  float spiral = angle + dist * u_complexity * 0.5 - time * 0.3;
  float n = fbm(vec2(spiral, dist) * 2.0, int(u_complexity)) * u_distortion;

  float colorVal = fract(spiral + n);
  return getGradientColor(colorVal);
}
#endif

#if WAVR_GRADIENT == 4
vec3 plasmaGradient(vec2 uv, float time) {
  // Plasma: mouse creates interference patterns like a stone in water
  vec2 p = uv * u_scale * 3.0;

  // Mouse interference: strong overlapping wave rings from cursor
  float mouseWave = 0.0;
  if (u_mouseReact > 0.0) {
    vec2 toMouse = uv * u_scale * 3.0 - u_mouseSmooth * u_scale * 3.0;
    float mDist = length(toMouse);
    float speed = length(u_mouseVelocity);
    // Primary wave: big expanding rings
    mouseWave = sin(mDist * 5.0 - time * 4.0) * u_mouseReact;
    mouseWave *= smoothstep(3.0, 0.0, mDist);
    // Secondary interference from velocity
    mouseWave += sin(mDist * 8.0 - time * 6.0) * u_mouseReact * 0.4 * smoothstep(2.0, 0.0, mDist);
    mouseWave *= (1.0 + speed * 0.01);
  }

  float v = 0.0;
  v += sin(p.x * u_complexity + time);
  v += sin((p.y * u_complexity + time) * 0.7);
  v += sin((p.x * u_complexity + p.y * u_complexity + time) * 0.5);
  float cx = p.x + 0.5 * sin(time * 0.3);
  float cy = p.y + 0.5 * cos(time * 0.4);
  v += sin(sqrt(cx * cx + cy * cy + 1.0) * u_complexity);
  v += mouseWave;

  float colorVal = v * 0.25 + 0.5;
  colorVal += fbm(p * 0.5 + time * 0.1, int(min(u_complexity, 4.0))) * u_distortion * 0.3;
  float hardWrap = fract(colorVal);
  float softWave = 0.5 + 0.5 * sin(colorVal * 6.28318);
  return getGradientColor(mix(hardWrap, softWave, u_softness));
}
#endif

#if WAVR_GRADIENT == 9
vec3 voronoiGradient(vec2 uv, float time) {
  // Voronoi: gravity lens — cells warp and bend around cursor
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = gravityDisplace(p, u_mouseReact);
    p = fluidDisplace(p, u_mouseReact * 0.3); // subtle push on top
  }
  p *= u_scale * 4.0;

  // Animate cell positions
  vec2 v = voronoi(p + time * 0.2);
  float cellDist = v.x;
  float cellEdge = v.y;

  // Add fbm warp for organic feel
  float warp = fbm(p * 0.5 + time * 0.1, int(u_complexity)) * u_distortion;
  cellDist += warp * 0.3;

  // Map distance to color
  float colorVal = fract(cellDist + cellEdge * 0.5);
  return getGradientColor(colorVal);
}
#endif

// ============================================================
// Soft Premium Shader Nodes
// ============================================================


#if WAVR_GRADIENT == 10
vec3 silkGradient(vec2 uv, float time) {
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = fluidDisplace(p, u_mouseReact * 0.55);
  }
  p = (p - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0) + 0.5;
  p *= u_scale * 1.35;

  float warpAmount = 0.35 + u_distortion * 1.6 + u_softness * 0.45;
  p = softDomainWarp(p, time, warpAmount);

  float flow = 0.5 + 0.5 * sin(p.x * 1.7 + p.y * 2.2 + time * 0.22);
  flow += snoise(p * 1.35 + vec2(time * 0.06, -time * 0.04)) * 0.18;
  float ribbonA = 0.5 + 0.5 * sin((p.y * 2.1 + p.x * 0.55 + flow * 1.65 + time * 0.22) * 3.14159);
  float ribbonB = 0.5 + 0.5 * sin((p.y * 3.0 - p.x * 0.75 - flow * 1.35 - time * 0.16) * 3.14159);
  float field = mix(ribbonA, ribbonB, 0.28 + u_softness * 0.2);
  field = mix(field, clamp(flow, 0.0, 1.0), 0.18 + u_distortion * 0.15);

  return finishSoftGradient(field, ribbonA * 0.65);
}
#endif

#if WAVR_GRADIENT == 11
vec3 auroraGradient(vec2 uv, float time) {
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = gravityDisplace(p, u_mouseReact * 0.35);
  }
  p *= u_scale;
  float drift = time * 0.13;

  float curtain = 0.5 + 0.5 * sin(p.x * 2.4 + drift);
  curtain += snoise(vec2(p.x * 1.1 + drift, p.y * 0.6)) * 0.22;
  float wave = sin((p.x * 2.2 + curtain * 2.8 + drift) * 3.14159) * 0.5 + 0.5;
  float vertical = smoothstep(-0.15, 0.92, 1.0 - p.y + curtain * 0.35);
  float field = mix(wave, vertical, 0.46);

  vec3 color = finishSoftGradient(field, vertical);
  float veil = pow(max(0.0, wave * vertical), 2.0) * (0.18 + u_softness * 0.24);
  return color + veil;
}
#endif

#if WAVR_GRADIENT == 12
vec3 liquidGradient(vec2 uv, float time) {
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = fluidDisplace(p, u_mouseReact * 0.7);
  }
  p = (p - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0) + 0.5;
  p *= u_scale * 1.35;
  p = softDomainWarp(p, time, u_distortion * 1.15 + u_softness * 0.35);

  float field = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 center = vec2(
      0.5 + 0.45 * sin(time * (0.12 + fi * 0.015) + fi * 2.31),
      0.5 + 0.42 * cos(time * (0.10 + fi * 0.02) + fi * 1.73)
    );
    center *= u_scale * 1.15;
    float radius = 0.12 + hash(vec2(fi, 2.0)) * 0.22 + u_softness * 0.08;
    float d = length(p - center);
    field += radius * radius / (d * d + 0.035 + u_softness * 0.08);
  }

  field = 1.0 - exp(-field * (0.42 + u_distortion * 0.25));
  float flow = signedTo01(snoise(p * 1.25 + time * 0.08));
  field = mix(field, flow, 0.16);
  return finishSoftGradient(field, field);
}
#endif

#if WAVR_GRADIENT == 13
vec3 softCellsGradient(vec2 uv, float time) {
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = gravityDisplace(p, u_mouseReact * 0.45);
    p = fluidDisplace(p, u_mouseReact * 0.15);
  }
  p *= u_scale * 3.2;
  p = softDomainWarp(p, time, u_distortion * 1.35 + u_softness * 0.45);

  vec2 v = voronoi(p + time * 0.12);
  float cell = smoothstep(0.05, 0.82 + u_softness * 0.28, v.x);
  float wash = signedTo01(snoise(p * 0.42 + vec2(time * 0.04, -time * 0.03)));
  float field = mix(cell, wash, 0.35 + u_softness * 0.2);
  return finishSoftGradient(field, 1.0 - cell);
}
#endif

#if WAVR_GRADIENT == 14
vec3 grainflowGradient(vec2 uv, float time) {
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = magnetDisplace(p, u_mouseReact * 0.35);
  }
  p = (p - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0) + 0.5;
  p *= u_scale * 1.55;
  p = softDomainWarp(p, time, u_distortion * 1.15 + u_softness * 0.42);

  float cloth = signedTo01(snoise(p * 1.05 + vec2(time * 0.12, time * 0.04)));
  float warp = snoise(p * 1.8 + cloth + vec2(-time * 0.06, time * 0.09));
  float bandA = 0.5 + 0.5 * sin((p.x * 1.2 + p.y * 0.38 + warp * 1.9 + time * 0.11) * 6.28318);
  float bandB = 0.5 + 0.5 * sin((p.x * -0.42 + p.y * 1.65 + cloth * 1.5 - time * 0.08) * 6.28318);
  float field = mix(cloth, mix(bandA, bandB, 0.38), 0.34);
  field = mix(field, smoothstep(0.12, 0.95, field), u_softness * 0.55);
  vec3 color = finishSoftGradient(field, max(bandA, bandB) * 0.35);

  float grain = interleavedGradientNoise(gl_FragCoord.xy + vec2(time * 31.0, -time * 17.0)) - 0.5;
  float paper = hash(floor(gl_FragCoord.xy / max(2.0, 7.0 - u_complexity * 0.5))) - 0.5;
  float weave = sin(gl_FragCoord.x * 1.7) * sin(gl_FragCoord.y * 1.15) * 0.5;
  color += (grain * 0.035 + paper * 0.026 + weave * 0.012) * (0.45 + u_softness);
  return clamp(color, 0.0, 1.2);
}
#endif

#if WAVR_GRADIENT == 15
vec3 prismGlassGradient(vec2 uv, float time) {
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = gravityDisplace(p, u_mouseReact * 0.42);
  }
  p = (p - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  p *= u_scale * 1.25;
  p = softDomainWarp(p + 0.5, time, u_distortion * 1.25 + u_softness * 0.35) - 0.5;

  float angle = atan(p.y, p.x);
  float radius = length(p);
  float sheet = 0.5 + 0.5 * sin((p.x * 1.8 - p.y * 1.15 + snoise(p * 1.6 + time * 0.08) * 1.7 + time * 0.16) * 6.28318);
  float fold = 1.0 - smoothstep(0.02, 0.5 + u_softness * 0.22, abs(sin(angle * 2.0 + radius * 5.2 - time * 0.2)));
  float caustic = pow(1.0 - smoothstep(0.0, 0.34, abs(sheet - 0.62)), 2.1);
  float field = mix(signedTo01(snoise(p * 1.15 + time * 0.05)), sheet, 0.5);
  vec3 color = finishSoftGradient(field, caustic + fold * 0.35);
  color += vec3(0.06, 0.12, 0.18) * caustic * (0.55 + u_softness);
  color += vec3(0.35, 0.18, 0.08) * fold * 0.16;
  return clamp(color, 0.0, 1.35);
}
#endif

#if WAVR_GRADIENT == 16
vec3 neonTunnelGradient(vec2 uv, float time) {
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = vortexDisplace(p, u_mouseReact * 0.48);
  }
  p = (p - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  p *= u_scale;
  p = softDomainWarp(p + 0.5, time, u_distortion * 0.8 + u_softness * 0.22) - 0.5;

  float radius = length(p);
  float angle = atan(p.y, p.x);
  float depth = 1.0 / (0.18 + radius * 1.55);
  float spiral = angle * 1.85 + radius * (9.0 + u_complexity * 0.85) - time * 0.42;
  float contour = 1.0 - smoothstep(0.015, 0.22 + u_softness * 0.22, abs(fract(spiral / 6.28318) - 0.5));
  float haze = smoothstep(1.0, 0.12, radius);
  float field = mix(fract(depth * 0.42 + angle / 6.28318 + time * 0.05), contour, 0.55);
  vec3 color = finishSoftGradient(field, contour * haze);
  color += getGradientColor(fract(field + 0.22)) * contour * haze * (0.45 + u_softness * 0.35);
  color *= 0.62 + depth * 0.18;
  return clamp(color, 0.0, 1.4);
}
#endif

// ============================================================
// Dither / Halftone Gradient
// ============================================================

#if WAVR_GRADIENT == 5
vec3 ditherGradient(vec2 uv, float time) {
  // Mouse: magnet pull — dots cluster toward cursor
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = magnetDisplace(p, u_mouseReact);
  }

  // Build luminance field: blend between clean gradient and organic noise
  // Low complexity (1) = clean directional dissolution (image 2 style)
  // High complexity (8) = organic flowing pattern (image 1 style)
  float organicMix = clamp((u_complexity - 1.0) / 7.0, 0.0, 1.0);

  // Clean gradient: simple vertical dissolution
  float cleanLum = 1.0 - p.y; // top = sparse, bottom = dense

  // Organic field: fBm noise with domain warping for flowing texture
  vec2 np = p * u_scale * 2.0;
  int octaves = int(u_complexity);
  float warp = u_distortion + u_domainWarp * 0.5;
  float n1 = fbm(np + vec2(time * 0.25, time * 0.18), octaves);
  float n2 = fbm(np + vec2(n1 * warp + time * 0.1, n1 * warp - time * 0.12), octaves);
  float n3 = fbm(np + vec2(n2 * warp * 0.7, n2 * warp * 0.7 + time * 0.06), octaves);
  float organicLum = n3 * 0.5 + 0.5;

  // Blend between clean and organic
  float luminance = mix(cleanLum, organicLum, organicMix);

  // Add subtle time-based movement even in clean mode
  float drift = snoise(p * u_scale + vec2(time * 0.15, time * 0.1)) * u_distortion * 0.3;
  luminance += drift * (1.0 - organicMix * 0.5);
  luminance = clamp(luminance, 0.0, 1.0);

  // Grid cell: divide into dot grid
  // Scale controls cell size — larger scale = bigger cells = fewer dots
  float cellSize = max(u_scale * 8.0, 2.0);
  vec2 cellCoord = gl_FragCoord.xy / cellSize;
  vec2 cellId = floor(cellCoord);
  vec2 cellUV = fract(cellCoord) - 0.5; // centered at 0,0

  // Sample luminance at cell center for uniform dot sizing
  vec2 cellCenterUV = (cellId + 0.5) * cellSize / u_resolution;
  // Re-evaluate luminance at cell center
  vec2 cp = cellCenterUV;
  if (u_mouseReact > 0.0) {
    cp = magnetDisplace(cp, u_mouseReact);
  }
  float cellClean = 1.0 - cp.y;
  vec2 cnp = cp * u_scale * 2.0;
  float cn1 = fbm(cnp + vec2(time * 0.25, time * 0.18), octaves);
  float cn2 = fbm(cnp + vec2(cn1 * warp + time * 0.1, cn1 * warp - time * 0.12), octaves);
  float cn3 = fbm(cnp + vec2(cn2 * warp * 0.7, cn2 * warp * 0.7 + time * 0.06), octaves);
  float cellOrganic = cn3 * 0.5 + 0.5;
  float cellLum = mix(cellClean, cellOrganic, organicMix);
  float cellDrift = snoise(cp * u_scale + vec2(time * 0.15, time * 0.1)) * u_distortion * 0.3;
  cellLum += cellDrift * (1.0 - organicMix * 0.5);
  cellLum = clamp(cellLum, 0.0, 1.0);

  // Dot radius: luminance drives how large the dot is
  // High luminance (bright) = large dot (dense), low = small dot (sparse)
  float dotRadius = cellLum * 0.5;

  // Distance from cell center — circular dots
  float dist = length(cellUV);

  // Sharp edge for crisp halftone dots
  float dot = 1.0 - smoothstep(dotRadius - 0.02, dotRadius + 0.02, dist);

  // Colors: colors[0] = dot color, colors[1] = background
  vec3 dotColor = u_colors[0];
  vec3 bgColor = u_colorCount > 1 ? u_colors[1] : vec3(1.0);
  vec3 crisp = mix(bgColor, dotColor, dot);
  vec3 softBase = getGradientColor(cellLum);
  vec3 softened = mix(softBase, dotColor, dot * 0.45);
  return mix(crisp, softened, u_softness * 0.85);
}
#endif

// ============================================================
// Scanline / CRT Gradient
// ============================================================

#if WAVR_GRADIENT == 6
vec3 scanlineGradient(vec2 uv, float time) {
  // Mouse: gravity lens — bends columns around cursor
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = gravityDisplace(p, u_mouseReact);
  }

  // Number of vertical columns driven by complexity
  float numColumns = floor(u_complexity * 3.0 + 2.0); // 5–26 columns

  // Vertical scanline stripe pattern
  float stripeFreq = u_scale * 200.0;
  float stripe = sin(p.x * stripeFreq * 3.14159) * 0.5 + 0.5;
  stripe = smoothstep(0.3, 0.7, stripe); // sharpen to thin lines
  float scanlineMask = mix(0.15, 1.0, stripe); // dark gaps between lines

  // Fine horizontal crosshatch overlay (halftone grid texture)
  float hatchFreq = u_scale * 120.0;
  float hatch = sin(p.y * hatchFreq * 3.14159) * 0.5 + 0.5;
  hatch = smoothstep(0.4, 0.6, hatch);
  float crosshatch = mix(0.7, 1.0, hatch);

  // Build color blocks — each column gets a color and a height
  vec3 color = vec3(0.0);
  float totalWeight = 0.0;

  for (int i = 0; i < 8; i++) {
    if (float(i) >= numColumns) break;

    float fi = float(i);
    // Column x position and width
    float colCenter = (fi + 0.5) / numColumns;
    float colWidth = 1.0 / numColumns;

    // Distance from column center (horizontal)
    float dx = abs(p.x - colCenter) / colWidth;
    float colMask = 1.0 - smoothstep(0.35, 0.55, dx);

    // Block height: each column rises to a different height
    // Animated with time and offset by noise for organic movement
    float heightSeed = hash(vec2(fi * 7.13, 3.17));
    float heightAnim = sin(time * 0.4 + fi * 1.7) * u_distortion * 0.3;
    float blockHeight = 0.2 + heightSeed * 0.6 + heightAnim;
    blockHeight = clamp(blockHeight, 0.05, 0.95);

    // Block extends from bottom — stronger at bottom, fades at top
    float blockMask = smoothstep(blockHeight + 0.02, blockHeight - 0.05, 1.0 - p.y);

    // Color from palette — cycle through available colors
    int colorIdx = int(mod(fi, float(u_colorCount)));
    vec3 blockColor = u_colors[colorIdx];

    // Accumulate with additive-ish blending for overlap glow
    float weight = colMask * blockMask;
    color += blockColor * weight;
    totalWeight += weight;
  }

  // Normalize but preserve additive overlap brightness
  if (totalWeight > 0.0) {
    color = color / max(totalWeight, 0.5);
    color *= min(totalWeight, 1.5); // allow slight over-bright on overlaps
  }

  // Apply scanline and crosshatch textures
  color *= scanlineMask * crosshatch;

  // Subtle background noise (dark halftone texture on empty areas)
  float bgNoise = hash(floor(gl_FragCoord.xy / 2.0)) * 0.06;
  color += vec3(bgNoise) * (1.0 - min(totalWeight, 1.0));

  return color;
}
#endif

// ============================================================
// Glitch / Data Drag Gradient
// ============================================================

#if WAVR_GRADIENT == 7
vec3 glitchGradient(vec2 uv, float time) {
  // Mouse: vortex — data corruption spiral near cursor
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = vortexDisplace(p, u_mouseReact);
  }

  // Mode blend: low complexity = vertical slit-scan, high = horizontal data mosh
  float moshMix = clamp((u_complexity - 1.0) / 7.0, 0.0, 1.0);

  vec3 color = vec3(0.0);

  // === LAYER 1: Vertical slit-scan streaks (dominant at low complexity) ===
  {
    // Divide into vertical columns
    float numCols = 30.0 + u_complexity * 10.0;
    float colId = floor(p.x * numCols);
    float colFrac = fract(p.x * numCols);

    // Each column has a unique drag amount — hash gives deterministic randomness
    float dragSeed = hash(vec2(colId, 1.0));
    float dragAnim = sin(time * 0.3 + colId * 0.7) * 0.2;
    float dragAmount = (dragSeed * 0.7 + 0.1 + dragAnim) * u_distortion;

    // The "source" y-position — where this column samples its color from
    // Columns with high drag stretch a small y-range over the full height
    float sourceY = mix(p.y, dragSeed * 0.4 + 0.3, dragAmount);

    // Color from palette based on source position
    float colorT = fract(sourceY + dragSeed * 0.3);
    vec3 slitColor = getGradientColor(colorT);

    // Brightness varies by drag amount — stretched columns glow brighter
    float brightness = 0.6 + dragAmount * 0.8;
    slitColor *= brightness;

    // Thin column gaps for that slit-scan line separation
    float columnMask = smoothstep(0.0, 0.08, colFrac) * smoothstep(1.0, 0.92, colFrac);

    // Vertical fade — streaks are strongest in the middle band, fade at edges
    float verticalPresence = smoothstep(0.0, 0.15, p.y) * smoothstep(1.0, 0.7, p.y);
    verticalPresence = mix(verticalPresence, 1.0, dragAmount * 0.5);

    color += slitColor * columnMask * verticalPresence * (1.0 - moshMix * 0.7);
  }

  // === LAYER 2: Horizontal data mosh bands (dominant at high complexity) ===
  {
    // Create horizontal band structure
    float bandScale = 8.0 + u_complexity * 4.0;
    float bandId = floor(p.y * bandScale);
    float bandFrac = fract(p.y * bandScale);

    // Each band has unique properties
    float bandSeed = hash(vec2(bandId, 7.77));
    float bandSeed2 = hash(vec2(bandId, 13.31));

    // Band visibility — not all bands are active (sparse on dark bg)
    float activity = step(0.55 - u_distortion * 0.3, bandSeed);

    // Horizontal offset/smear — the "corruption" displacement
    float smearTime = floor(time * 2.0 + bandId) * 0.5; // quantized time for stutter
    float smear = hash(vec2(bandId, smearTime)) * 2.0 - 1.0;
    smear *= u_distortion * 0.4;

    // Block size within band — some bands are chunky, some are fine
    float blockSize = mix(0.02, 0.15, bandSeed2) * u_scale;
    float blockId = floor((p.x + smear) / blockSize);
    float blockSeed = hash(vec2(blockId, bandId));

    // Color: sample from palette with offset
    float colorT = fract(bandSeed * 0.7 + blockSeed * 0.3 + time * 0.05);
    vec3 bandColor = getGradientColor(colorT);

    // Block-level variation — some blocks within band are brighter/dimmer
    float blockBright = 0.3 + blockSeed * 0.9;

    // Band edge softness
    float bandMask = smoothstep(0.0, 0.1, bandFrac) * smoothstep(1.0, 0.9, bandFrac);

    // Horizontal extent — bands don't span full width
    float bandWidth = 0.2 + bandSeed2 * 0.6;
    float bandCenter = bandSeed * 0.6 + 0.2 + sin(time * 0.4 + bandId) * 0.1;
    float hMask = smoothstep(bandCenter - bandWidth * 0.5 - 0.02, bandCenter - bandWidth * 0.5, p.x)
                * smoothstep(bandCenter + bandWidth * 0.5 + 0.02, bandCenter + bandWidth * 0.5, p.x);

    // Occasional bright "signal" flash
    float flash = step(0.92, hash(vec2(bandId, floor(time * 3.0))));
    blockBright += flash * 1.5;

    color += bandColor * bandMask * hMask * activity * blockBright * moshMix;
  }

  // === LAYER 3: Micro-detail — fine scanline texture ===
  {
    // Subtle horizontal scanlines for CRT texture
    float scanline = sin(gl_FragCoord.y * 1.5) * 0.5 + 0.5;
    scanline = mix(1.0, 0.85 + scanline * 0.15, 0.4);
    color *= scanline;
  }

  // === LAYER 4: Chromatic split on bright areas ===
  {
    float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
    if (lum > 0.3) {
      // Subtle RGB channel offset for that digital-artifact shimmer
      float shift = u_distortion * 0.008;
      float rOff = hash(vec2(floor(p.y * 80.0), floor(time * 4.0))) * shift;
      float bOff = hash(vec2(floor(p.y * 80.0), floor(time * 4.0) + 100.0)) * shift;
      // Only shift the contribution, not re-sample the whole gradient
      color.r *= 1.0 + rOff * 5.0;
      color.b *= 1.0 + bOff * 5.0;
    }
  }

  // === LAYER 5: Reflection/ghost below bright bands ===
  {
    // Sample from mirrored y position (reflected below)
    float mirrorY = 1.0 - p.y;
    float reflBandId = floor(mirrorY * (8.0 + u_complexity * 4.0));
    float reflSeed = hash(vec2(reflBandId, 7.77));
    float reflActivity = step(0.55 - u_distortion * 0.3, reflSeed);

    // Ghost reflection: much dimmer, slightly blurred
    float reflStrength = 0.12 * moshMix * reflActivity;
    float reflFade = smoothstep(0.5, 1.0, p.y); // only visible in bottom half
    color += color * reflStrength * reflFade;
  }

  return color;
}
#endif

// ============================================================
// Image Gradient (type 8) — samples uploaded texture
// ============================================================

#if WAVR_GRADIENT == 8
vec3 imageGradient(vec2 uv, float time) {
  vec2 imgUV = (uv - 0.5) / u_imageScale + 0.5 + u_imageOffset;

  // Apply mouse displacement before sampling — fluid push on image
  if (u_mouseReact > 0.01) {
    vec2 mouseDir = imgUV - u_mouseSmooth;
    float mouseDist = length(mouseDir);
    float mouseRadius = 0.5 + u_mouseReact * 0.3;
    float influence = smoothstep(mouseRadius, 0.0, mouseDist);
    influence *= influence;
    float speed = length(u_mouseVelocity);
    imgUV += (mouseDir / (mouseDist + 0.001)) * influence * 0.12 * u_mouseReact;
    imgUV += u_mouseVelocity * influence * 0.02 * (1.0 + speed * 0.002);
  }

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
