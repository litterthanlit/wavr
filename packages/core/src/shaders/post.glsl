// Post program: global effects on the composited layers (u_sceneTexture). It
// contains no gradient code. Needs common.glsl ahead of it.

// ============================================================
// Curl Noise (divergence-free 2D flow field)
// ============================================================

vec2 curlNoise(vec2 p, float time) {
  float eps = 0.01;
  // Compute partial derivatives of noise to get curl
  float n1 = snoise(p + vec2(0.0, eps) + time * 0.3);
  float n2 = snoise(p - vec2(0.0, eps) + time * 0.3);
  float n3 = snoise(p + vec2(eps, 0.0) + time * 0.3);
  float n4 = snoise(p - vec2(eps, 0.0) + time * 0.3);
  // Curl: perpendicular to gradient = divergence-free
  float dndx = (n3 - n4) / (2.0 * eps);
  float dndy = (n1 - n2) / (2.0 * eps);
  return vec2(dndy, -dndx);
}

// ============================================================
// Liquify Distortion
// ============================================================

vec2 liquify(vec2 uv, float time, float intensity) {
  vec2 warp = uv;
  for (int i = 0; i < 3; i++) {
    float scale = u_liquifyScale + float(i) * 1.5;
    float speed = 0.1 + float(i) * 0.05;
    vec2 offset = vec2(
      snoise(warp * scale + vec2(time * speed, 0.0)),
      snoise(warp * scale + vec2(100.0, time * speed + 50.0))
    );
    warp += offset * intensity * (0.5 / float(i + 1));
  }
  return warp;
}

// ============================================================
// Tone Mapping
// ============================================================

vec3 acesToneMap(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

// ============================================================
// Caustics
// ============================================================

float caustic(vec2 uv, float time) {
  float c = 0.0;
  for (int i = 0; i < 3; i++) {
    float scale = 4.0 + float(i) * 2.0;
    float speed = 0.5 + float(i) * 0.2;
    vec2 p = uv * scale + time * speed;
    float w1 = sin(p.x + sin(p.y * 1.5 + time));
    float w2 = sin(p.y + sin(p.x * 1.3 - time * 0.7));
    c += abs(w1 * w2) * (1.0 / float(i + 1));
  }
  return c;
}

// ============================================================
// Post-Processing
// ============================================================

vec3 adjustSaturation(vec3 color, float sat) {
  float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(grey), color, sat);
}

vec3 rotateHue(vec3 color, float angle) {
  // Rodrigues rotation around the (1,1,1)/sqrt(3) axis in RGB space
  float cosA = cos(angle);
  float sinA = sin(angle);
  vec3 k = vec3(0.57735); // 1/sqrt(3)
  return color * cosA + cross(k, color) * sinA + k * dot(k, color) * (1.0 - cosA);
}

// ============================================================
// Scene access
// ============================================================

// The composited layers. Effects that need neighbouring pixels (bloom, glow,
// blur, chromatic aberration, pixel sort, radial blur) read them through here:
// one texture fetch each, never a gradient evaluation. textureLod: some callers
// sit in non-uniform control flow. `uv` is 0..1 over the canvas; when the
// layers were drawn at a reduced render scale, compositeUV picks the drawn
// part of the target and the linear filter upsamples it.
vec4 sampleSceneRGBA(vec2 uv) {
  return textureLod(u_sceneTexture, compositeUV(uv, vec2(textureSize(u_sceneTexture, 0))), 0.0);
}

vec3 sampleScene(vec2 uv) {
  return sampleSceneRGBA(uv).rgb;
}

// ============================================================
// Main — global effects on the composited layers
// ============================================================

void main() {
  vec2 uv = v_uv;
  float time = u_time * u_speed;

  // Curl noise UV distortion (fluid-like swirling)
  if (u_curlEnabled) {
    vec2 curl = curlNoise(uv * u_curlScale * 3.0, time);
    uv += curl * u_curlIntensity * 0.1;
  }

  // Liquify distortion (multi-octave organic fluid warping)
  if (u_liquifyEnabled) {
    uv = liquify(uv, time, u_liquifyIntensity);
  }

  // Kaleidoscope (radial mirror symmetry)
  if (u_kaleidoscopeEnabled) {
    vec2 centered = uv - 0.5;
    float angle = atan(centered.y, centered.x) + u_kaleidoscopeRotation * 6.28318 / 360.0;
    float r = length(centered);
    float segments = max(u_kaleidoscopeSegments, 2.0);
    float segAngle = 6.28318 / segments;
    angle = mod(angle, segAngle);
    // Mirror alternate segments for seamless reflection
    if (mod(floor(angle / segAngle + 0.5), 2.0) > 0.5) {
      angle = segAngle - angle;
    }
    uv = vec2(cos(angle), sin(angle)) * r + 0.5;
  }

  // Pointer trail, part 1: the streak bends the picture like a drop of water
  // dragged across glass. trail.glsl keeps an energy field; its slope pulls the
  // lookup towards the ridge, a soft magnifier along the stroke.
  float trailEnergy = 0.0;
  if (u_trailEnabled) {
    vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
    vec2 reach = 1.5 / vec2(textureSize(u_trailTexture, 0));
    float exLo = texture(u_trailTexture, uv - vec2(reach.x, 0.0)).r;
    float exHi = texture(u_trailTexture, uv + vec2(reach.x, 0.0)).r;
    float eyLo = texture(u_trailTexture, uv - vec2(0.0, reach.y)).r;
    float eyHi = texture(u_trailTexture, uv + vec2(0.0, reach.y)).r;
    vec2 slope = vec2(exHi - exLo, eyHi - eyLo) / (2.0 * reach * aspect); // energy per canvas height
    uv += slope * (u_trailWidth * u_trailWidth * 0.30) / aspect;
    trailEnergy = texture(u_trailTexture, uv).r;
  }

  // Click ripple, part 1: a thin ring that eases out from the click, in
  // aspect-correct space and real seconds, refracting the picture as it passes.
  // RIPPLE_LIFE is RIPPLE_DURATION in pointer.ts.
  float rippleGlow = 0.0;
  if (u_rippleEnabled > 0.5) {
    const float RIPPLE_LIFE = 1.6;
    vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
    vec2 fromClick = (uv - u_rippleOrigin) * aspect;
    float life = clamp(u_rippleTime / RIPPLE_LIFE, 0.0, 1.0);
    float front = 0.60 * (1.0 - pow(1.0 - life, 3.0)); // ease-out radius, canvas heights
    float width = mix(0.020, 0.058, life);             // the ring softens as it travels
    float x = (length(fromClick) - front) / width;
    float body = max(1.0 - x * x, 0.0);                // C1 profile, exactly zero outside the ring
    float fade = (1.0 - life) * (1.0 - life) * smoothstep(0.0, 0.05, u_rippleTime);
    rippleGlow = body * body * fade * u_rippleIntensity;
    // Refraction: displacement follows the slope of the ring, away from the centre.
    vec2 outward = fromClick / sqrt(dot(fromClick, fromClick) + 0.0004);
    uv += outward * (x * body * fade * width * 1.1 * u_rippleIntensity) / aspect;
  }

  // Scene colour (with optional radial zoom blur)
  vec3 color;
  if (u_radialBlurAmount > 0.001) {
    vec2 center = vec2(0.5);
    vec2 dir = uv - center;
    float strength = u_radialBlurAmount * 0.02;
    const int SAMPLES = 12;
    color = vec3(0.0);
    for (int s = 0; s < SAMPLES; s++) {
      float t = float(s) / float(SAMPLES - 1) - 0.5;
      color += sampleScene(uv - dir * t * strength);
    }
    color /= float(SAMPLES);
  } else {
    color = sampleScene(uv);
  }

  // Noise overlay — Photoshop-style: fine grain texture that multiplies over the image
  if (u_noiseEnabled) {
    vec2 np = uv * u_noiseScale * 60.0;
    // 4-octave fBm for natural organic texture
    float n = snoise(np + time * 0.15) * 0.5;
    n += snoise(np * 2.17 - time * 0.1) * 0.25;
    n += snoise(np * 4.31 + time * 0.2) * 0.125;
    n += snoise(np * 8.53) * 0.0625;
    n = n * 0.533 + 0.5; // normalize 0-1
    // Soft light blend (Photoshop formula): preserves color, adds texture
    vec3 noiseColor = vec3(n);
    vec3 softLight = mix(
      2.0 * color * noiseColor + color * color * (1.0 - 2.0 * noiseColor),
      2.0 * color * (1.0 - noiseColor) + sqrt(color) * (2.0 * noiseColor - 1.0),
      step(0.5, noiseColor)
    );
    color = mix(color, softLight, u_noiseIntensity);
  }

  // Reaction-diffusion pattern overlay (Turing-like patterns)
  if (u_reactionDiffEnabled) {
    vec2 rp = uv * u_reactionDiffScale * 8.0;
    // Layered noise with competing activator/inhibitor scales
    float activator = snoise(rp + time * 0.15);
    float inhibitor = snoise(rp * 0.5 + time * 0.1 + 100.0);
    // Sharp threshold creates organic spots/stripes
    float pattern = activator - inhibitor * 0.6;
    // Add fine-scale detail
    pattern += snoise(rp * 2.0 + time * 0.2) * 0.3;
    // Threshold for crisp pattern edges
    float mask = smoothstep(-0.1, 0.1, pattern);
    vec3 rdColor = mix(
      getGradientColor(0.2),
      getGradientColor(0.8),
      mask
    );
    color = mix(color, rdColor, u_reactionDiffIntensity);
  }

  // Chromatic aberration — lens-style radial fringing, stronger at edges
  if (u_chromaticAberration > 0.001) {
    vec2 center = vec2(0.5);
    vec2 dir = uv - center;
    float edgeDist = length(dir); // stronger toward edges like a real lens
    float caOffset = u_chromaticAberration * 0.012 * (0.5 + edgeDist);
    vec3 cR = sampleScene(uv + dir * caOffset);
    vec3 cG = sampleScene(uv + dir * caOffset * 0.5);
    vec3 cB = sampleScene(uv - dir * caOffset);
    color = vec3(cR.r, cG.g, cB.b);
  }

  // Hue shift
  if (abs(u_hueShift) > 0.01) {
    color = rotateHue(color, u_hueShift * 6.28318 / 360.0);
  }

  // Saturation
  color = adjustSaturation(color, u_saturation);

  // Brightness
  color *= u_brightness;

  // Bloom — multi-radius gaussian-weighted glow on bright areas
  if (u_bloomEnabled) {
    vec3 bloomSum = vec3(0.0);
    float totalWeight = 0.0;
    // Gaussian weights for 4 radii
    float weights[4] = float[](0.4, 0.3, 0.2, 0.1);
    float radii[4] = float[](0.005, 0.012, 0.025, 0.045);

    for (int a = 0; a < 8; a++) {
      float angle = float(a) * 0.785398;
      vec2 dir = vec2(cos(angle), sin(angle));
      for (int r = 0; r < 4; r++) {
        vec2 offset = dir * radii[r] * u_bloomIntensity;
        vec3 s = sampleScene(uv + offset);
        float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
        // Soft knee threshold — gradual onset instead of hard cutoff
        float knee = smoothstep(0.35, 0.75, lum);
        float w = knee * weights[r];
        bloomSum += s * w;
        totalWeight += w;
      }
    }

    if (totalWeight > 0.0) {
      bloomSum /= totalWeight;
      // Screen blend (Photoshop): brighter areas glow without clipping
      color = 1.0 - (1.0 - color) * (1.0 - bloomSum * u_bloomIntensity * 0.8);
    }
  }

  // Soft glow — Orton effect: dreamy highlight diffusion
  if (u_glowEnabled) {
    vec3 glow = vec3(0.0);
    float total = 0.0;
    for (int i = 0; i < 16; i++) {
      float angle = float(i) * 2.399; // golden angle spiral
      float r = sqrt(float(i + 1) / 17.0) * u_glowRadius;
      vec2 offset = vec2(cos(angle), sin(angle)) * r;
      vec3 s = sampleScene(uv + offset);
      // Weight by luminance — only bright areas glow
      float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
      float w = lum * (1.0 - r / u_glowRadius);
      glow += s * w;
      total += w;
    }
    if (total > 0.0) glow /= total;
    // Screen blend for the glow layer
    vec3 glowed = 1.0 - (1.0 - color) * (1.0 - glow * u_glowIntensity * 0.6);
    color = glowed;
  }

  // Caustics (water light refraction overlay)
  if (u_causticEnabled) {
    float caust = caustic(uv, time) * u_causticIntensity;
    color += color * caust * 0.3;
  }

  // Pointer trail, part 2: a lift of the picture's own colour along the stroke,
  // not white paint.
  color *= 1.0 + 0.30 * trailEnergy;

  // Click ripple, part 2: the ring brightens the colours it crosses, with a
  // faint sheen on the crest.
  color *= 1.0 + 0.9 * rippleGlow;
  color += 0.10 * rippleGlow * rippleGlow;

  // Vignette — natural lens falloff with elliptical shape
  if (u_vignette > 0.0) {
    vec2 vigUV = uv - 0.5;
    vigUV.x *= u_resolution.x / u_resolution.y; // aspect-correct
    float vig = length(vigUV) * 1.2;
    vig = vig * vig; // quadratic falloff like real optics
    vig = smoothstep(0.3, 1.0, vig);
    color *= 1.0 - vig * u_vignette;
  }

  // Gaussian blur (9-tap weighted kernel — blurs gradient, not pixel effects)
  if (u_blurEnabled && u_blurAmount > 0.0) {
    float px = u_blurAmount / u_resolution.x;
    float py = u_blurAmount / u_resolution.y;
    vec3 sum = color * 4.0;
    sum += sampleScene(uv + vec2(px, 0.0)) * 2.0;
    sum += sampleScene(uv - vec2(px, 0.0)) * 2.0;
    sum += sampleScene(uv + vec2(0.0, py)) * 2.0;
    sum += sampleScene(uv - vec2(0.0, py)) * 2.0;
    sum += sampleScene(uv + vec2(px, py));
    sum += sampleScene(uv - vec2(px, py));
    sum += sampleScene(uv + vec2(px, -py));
    sum += sampleScene(uv - vec2(px, -py));
    color = sum / 16.0;
  }

  // Feedback loop (before grain so noise doesn't accumulate across frames)
  if (u_feedbackEnabled) {
    vec3 prev = texture(u_prevFrame, v_uv).rgb;
    vec2 fbUV = v_uv + vec2(sin(u_time * 0.1) * 0.002, cos(u_time * 0.13) * 0.002);
    vec3 prevOffset = texture(u_prevFrame, fbUV).rgb;
    vec3 feedback = mix(prev, prevOffset, 0.5);
    color = mix(color, max(color, feedback), u_feedbackDecay);
  }

  // Film grain — photographic: chroma + luma noise, exposure-responsive
  if (u_grain > 0.0) {
    vec2 grainCoord = gl_FragCoord.xy;
    vec2 timeJitter = fract(u_time * vec2(43.0, 29.0));
    // Luma noise (fine grain)
    float lumaGrain = interleavedGradientNoise(grainCoord + timeJitter * 47.0) * 2.0 - 1.0;
    // Chroma noise (subtle color shift — like real film)
    float chromaR = interleavedGradientNoise(grainCoord + timeJitter * 23.0 + vec2(100.0, 0.0)) * 2.0 - 1.0;
    float chromaB = interleavedGradientNoise(grainCoord + timeJitter * 37.0 + vec2(0.0, 100.0)) * 2.0 - 1.0;
    // Exposure-dependent: more grain in shadows (like real high-ISO)
    float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float shadowGrain = mix(1.2, 0.4, smoothstep(0.0, 0.5, lum));
    float amount = u_grain * 0.05 * shadowGrain;
    color.r += (lumaGrain + chromaR * 0.3) * amount;
    color.g += lumaGrain * amount;
    color.b += (lumaGrain + chromaB * 0.3) * amount;
  }

  // Tone mapping
  if (u_toneMapMode == 1) {
    color = color / (color + 1.0);
  } else if (u_toneMapMode == 2) {
    color = acesToneMap(color);
  }

  // Pixel sorting (glitch art — horizontal streak displacement by brightness)
  if (u_pixelSortEnabled) {
    float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
    // Only sort pixels above the brightness threshold
    if (lum > u_pixelSortThreshold) {
      // Displacement amount scales with brightness distance from threshold
      float sortAmount = (lum - u_pixelSortThreshold) / (1.0 - u_pixelSortThreshold + 0.001);
      // Animated horizontal offset with noise for organic streaks
      float rowNoise = hash(vec2(floor(uv.y * u_resolution.y), floor(u_time * 2.0)));
      float offset = sortAmount * u_pixelSortIntensity * 0.15 * (rowNoise * 2.0 - 1.0);
      // Re-sample the scene at the displaced position
      vec2 sortedUV = uv + vec2(offset, 0.0);
      sortedUV.x = clamp(sortedUV.x, 0.0, 1.0);
      vec3 sortedColor = sampleScene(sortedUV);
      // Apply tone mapping to the re-sampled color too
      sortedColor = sortedColor / (sortedColor + 1.0);
      color = mix(color, sortedColor, sortAmount * u_pixelSortIntensity);
    }
  }

  // Ordered dithering (Bayer 4x4 matrix)
  if (u_ditherEnabled) {
    float cellSize = max(u_ditherSize, 1.0);
    vec2 pixel = floor(gl_FragCoord.xy / cellSize);
    int x = int(mod(pixel.x, 4.0));
    int y = int(mod(pixel.y, 4.0));
    // Bayer 4x4 threshold matrix (normalized to 0-1)
    float threshold;
    int idx = y * 4 + x;
    if (idx == 0) threshold = 0.0 / 16.0;
    else if (idx == 1) threshold = 8.0 / 16.0;
    else if (idx == 2) threshold = 2.0 / 16.0;
    else if (idx == 3) threshold = 10.0 / 16.0;
    else if (idx == 4) threshold = 12.0 / 16.0;
    else if (idx == 5) threshold = 4.0 / 16.0;
    else if (idx == 6) threshold = 14.0 / 16.0;
    else if (idx == 7) threshold = 6.0 / 16.0;
    else if (idx == 8) threshold = 3.0 / 16.0;
    else if (idx == 9) threshold = 11.0 / 16.0;
    else if (idx == 10) threshold = 1.0 / 16.0;
    else if (idx == 11) threshold = 9.0 / 16.0;
    else if (idx == 12) threshold = 15.0 / 16.0;
    else if (idx == 13) threshold = 7.0 / 16.0;
    else if (idx == 14) threshold = 13.0 / 16.0;
    else threshold = 5.0 / 16.0;
    // Quantize each channel: step(threshold, luminance)
    float levels = 4.0; // number of color levels
    color = floor(color * levels + threshold) / levels;
  }

  // ASCII art effect
  if (u_asciiEnabled) {
    float cellSize = max(u_asciiSize, 2.0);
    // Quantize UV to cell grid
    vec2 cell = floor(gl_FragCoord.xy / cellSize);
    vec2 cellUV = fract(gl_FragCoord.xy / cellSize);
    // Sample color at cell center for uniform cell color
    vec2 cellCenter = (cell + 0.5) * cellSize / u_resolution;
    // Use the already-computed color (re-map from cell center would be expensive)
    // Instead, quantize the existing color to the cell
    float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
    // ASCII density ramp: " .:-=+*#%@" (10 chars, mapped to luminance)
    // Render as dot patterns based on luminance
    vec2 cp = cellUV - 0.5;
    float dist = length(cp);
    // Higher luminance = larger filled area
    float charRadius = lum * 0.5;
    float charMask = smoothstep(charRadius + 0.02, charRadius - 0.02, dist);
    // Mix: dark cells show small dots, bright cells fill more
    color *= charMask * 1.2 + 0.1;
  }

  vec3 outColor = clamp(color, 0.0, 1.0);

  // Spec 0004: Deband — add ±0.5 LSB of noise per channel to smooth 8-bit banding.
  // Interleaved Gradient Noise (Jiménez) spreads error across high frequencies,
  // so the eye averages it against the gradient signal and banding disappears.
  if (u_debandEnabled) {
    float n = interleavedGradientNoise(gl_FragCoord.xy) - 0.5;
    outColor += vec3(n) * (u_debandStrength / 255.0);
  }

  // Alpha is whatever the layers left (opacity and masks).
  fragColor = vec4(outColor, sampleSceneRGBA(v_uv).a);
}
