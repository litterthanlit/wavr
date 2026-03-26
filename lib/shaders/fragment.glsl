#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

// Uniforms
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform vec2 u_mouseSmooth;
uniform vec2 u_mouseVelocity;
uniform int u_gradientType; // 0=mesh, 1=radial, 2=linear, 3=conic, 4=plasma
uniform float u_speed;
uniform float u_complexity;
uniform float u_scale;
uniform float u_distortion;
uniform float u_brightness;
uniform float u_saturation;
uniform vec3 u_colors[8];
uniform int u_colorCount;

// Effects
uniform bool u_noiseEnabled;
uniform float u_noiseIntensity;
uniform float u_noiseScale;
uniform float u_grain;
uniform bool u_particlesEnabled;
uniform float u_particleCount;
uniform float u_particleSize;
uniform float u_mouseReact;
uniform bool u_bloomEnabled;
uniform float u_bloomIntensity;
uniform float u_vignette;
uniform float u_radialBlurAmount;
uniform float u_colorBlend;
uniform float u_chromaticAberration;
uniform float u_hueShift;

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
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// ============================================================
// Physics-based Mouse Displacement
// ============================================================

// Fluid displacement: pushes UV coords away from mouse like a finger in water
vec2 fluidDisplace(vec2 uv, float strength) {
  vec2 toPixel = uv - u_mouseSmooth;
  float dist = length(toPixel);
  float radius = 0.35 * strength;

  // Gravity-well falloff: strong close, fades smoothly
  float influence = smoothstep(radius, 0.0, dist);
  influence *= influence; // quadratic falloff for more physicality

  // Displacement direction: push away from mouse + add velocity drag
  vec2 pushDir = normalize(toPixel + 0.0001);
  vec2 velInfluence = u_mouseVelocity * 0.002 * strength;

  return uv + (pushDir * influence * 0.15 + velInfluence * influence) * strength;
}

// Vortex swirl: rotates UV around mouse position
vec2 vortexDisplace(vec2 uv, float strength) {
  vec2 toPixel = uv - u_mouseSmooth;
  float dist = length(toPixel);
  float radius = 0.4 * strength;

  float influence = smoothstep(radius, 0.0, dist);
  float speed = length(u_mouseVelocity);
  float angle = influence * (0.5 + speed * 0.01) * strength;

  float s = sin(angle);
  float c = cos(angle);
  vec2 rotated = vec2(toPixel.x * c - toPixel.y * s, toPixel.x * s + toPixel.y * c);

  return u_mouseSmooth + rotated;
}

// Ripple: creates expanding wave rings from mouse
float rippleEffect(vec2 uv, float time) {
  float dist = length(uv - u_mouseSmooth);
  float speed = length(u_mouseVelocity);
  float rippleStr = smoothstep(0.5, 0.0, dist) * (0.3 + speed * 0.005);
  return sin(dist * 25.0 - time * 4.0) * rippleStr;
}

// ============================================================
// Color Interpolation
// ============================================================

vec3 sampleColorAt(float t) {
  t = clamp(t, 0.0, 1.0);
  float scaledT = t * float(u_colorCount - 1);
  int idx = int(floor(scaledT));
  float frac = fract(scaledT);
  frac = frac * frac * (3.0 - 2.0 * frac);

  int nextIdx = idx + 1;
  if (nextIdx >= u_colorCount) nextIdx = u_colorCount - 1;

  return mix(u_colors[idx], u_colors[nextIdx], frac);
}

vec3 getGradientColor(float t) {
  if (u_colorBlend < 0.01) {
    return sampleColorAt(t);
  }

  // Blend: sample multiple nearby positions and average for smooth transitions
  // Higher blend = wider sampling = colors melt into each other
  float spread = u_colorBlend * 0.15;
  vec3 color = sampleColorAt(t) * 0.4;
  color += sampleColorAt(t - spread) * 0.15;
  color += sampleColorAt(t + spread) * 0.15;
  color += sampleColorAt(t - spread * 2.0) * 0.1;
  color += sampleColorAt(t + spread * 2.0) * 0.1;
  color += sampleColorAt(t - spread * 0.5) * 0.05;
  color += sampleColorAt(t + spread * 0.5) * 0.05;
  return color;
}

// ============================================================
// Gradient Modes — each with physics-matched mouse interaction
// ============================================================

vec3 meshGradient(vec2 uv, float time) {
  // Mesh: fluid displacement — mouse pushes colors like water
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = fluidDisplace(p, u_mouseReact);
  }
  p *= u_scale;
  int octaves = int(u_complexity);

  // Layered fBm with velocity-influenced turbulence
  float velMag = length(u_mouseVelocity) * u_mouseReact * 0.001;
  float n1 = fbm(p + vec2(time * 0.3, time * 0.2), octaves);
  float n2 = fbm(p + vec2(n1 * u_distortion + time * 0.1 + velMag, n1 * u_distortion - time * 0.15), octaves);
  float n3 = fbm(p + vec2(n2 * u_distortion * 0.8 + velMag * 0.5, n2 * u_distortion * 0.8 + time * 0.05), octaves);

  float colorVal = n3 * 0.5 + 0.5;
  return getGradientColor(colorVal);
}

vec3 radialGradient(vec2 uv, float time) {
  // Radial: ripple waves emanate from mouse position
  vec2 center = vec2(0.5);
  vec2 p = (uv - center) * u_scale;
  float dist = length(p);
  float angle = atan(p.y, p.x);

  // Mouse creates ripple interference
  float mouseRipple = 0.0;
  if (u_mouseReact > 0.0) {
    mouseRipple = rippleEffect(uv, time) * u_mouseReact * u_distortion;
  }

  float wave = sin(dist * u_complexity * 3.14159 - time * 2.0 + angle * 2.0) * u_distortion;
  float n = fbm(vec2(dist + wave + mouseRipple, angle + time * 0.2) * 2.0, int(u_complexity));

  float colorVal = dist + n * u_distortion + mouseRipple * 0.5;
  colorVal = fract(colorVal);
  return getGradientColor(colorVal);
}

vec3 linearGradient(vec2 uv, float time) {
  // Linear: mouse bends the flow direction
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    // Bend the flow: displace perpendicular to gradient direction
    vec2 toMouse = uv - u_mouseSmooth;
    float dist = length(toMouse);
    float bend = smoothstep(0.4, 0.0, dist) * u_mouseReact;
    // Velocity determines bend direction
    p.y += bend * 0.15 * (1.0 + length(u_mouseVelocity) * 0.01);
    p.x += toMouse.x * bend * 0.1;
  }
  p *= u_scale;

  float base = p.x + p.y * 0.5;
  float wave = sin(p.y * u_complexity * 2.0 + time * 1.5) * u_distortion * 0.3;
  float n = fbm(p + vec2(time * 0.2, 0.0), int(u_complexity)) * u_distortion;

  float colorVal = fract(base + wave + n);
  return getGradientColor(colorVal);
}

vec3 conicGradient(vec2 uv, float time) {
  // Conic: vortex swirl at mouse position
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = vortexDisplace(p, u_mouseReact);
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

vec3 plasmaGradient(vec2 uv, float time) {
  // Plasma: mouse creates interference patterns like a stone in water
  vec2 p = uv * u_scale * 3.0;

  // Mouse interference: add a new wave source at mouse position
  float mouseWave = 0.0;
  if (u_mouseReact > 0.0) {
    vec2 toMouse = uv * u_scale * 3.0 - u_mouseSmooth * u_scale * 3.0;
    float mDist = length(toMouse);
    float speed = length(u_mouseVelocity);
    // Expanding rings from mouse, intensity based on reactivity
    mouseWave = sin(mDist * 6.0 - time * 3.0) * u_mouseReact * 0.6;
    mouseWave *= smoothstep(2.0, 0.0, mDist); // fade at distance
    mouseWave *= (1.0 + speed * 0.005); // stronger when moving fast
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
  return getGradientColor(fract(colorVal));
}

// ============================================================
// Particles (with physics-based mouse interaction)
// ============================================================

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float renderParticles(vec2 uv, float time) {
  float result = 0.0;
  float count = u_particleCount;
  float size = u_particleSize / u_resolution.x;

  for (float i = 0.0; i < 300.0; i++) {
    if (i >= count) break;

    vec2 seed = vec2(i * 0.123, i * 0.456);
    vec2 pos = vec2(hash(seed), hash(seed + 1.0));

    // Drift
    pos.x += sin(time * 0.3 + i * 0.7) * 0.05;
    pos.y += cos(time * 0.2 + i * 1.1) * 0.05;
    pos = fract(pos);

    // Physics-based mouse: particles orbit and scatter
    if (u_mouseReact > 0.0) {
      vec2 toMouse = u_mouseSmooth - pos;
      float mouseDist = length(toMouse);
      vec2 mouseDir = normalize(toMouse + 0.0001);
      float influence = smoothstep(0.3, 0.0, mouseDist);

      // Attract gently + add tangential orbit from velocity
      vec2 tangent = vec2(-mouseDir.y, mouseDir.x);
      float velDot = dot(normalize(u_mouseVelocity + 0.001), tangent);
      pos += mouseDir * influence * u_mouseReact * 0.02;
      pos += tangent * influence * velDot * u_mouseReact * 0.01;
    }
    pos = clamp(pos, 0.0, 1.0);

    float d = length(uv - pos);
    float glow = smoothstep(size * 3.0, 0.0, d) * 0.5;
    float core = smoothstep(size, size * 0.3, d);
    result += (glow + core) * (0.5 + 0.5 * hash(seed + 2.0));
  }
  return clamp(result, 0.0, 1.0);
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
// Main
// ============================================================

void main() {
  vec2 uv = v_uv;
  float time = u_time * u_speed;

  // Base gradient (with optional radial zoom blur)
  vec3 color;
  if (u_radialBlurAmount > 0.001) {
    // Radial zoom blur: sample along direction from center to pixel
    vec2 center = vec2(0.5);
    vec2 dir = uv - center;
    float strength = u_radialBlurAmount * 0.02;
    const int SAMPLES = 12;
    color = vec3(0.0);
    for (int s = 0; s < SAMPLES; s++) {
      float t = float(s) / float(SAMPLES - 1) - 0.5;
      vec2 sampleUV = uv - dir * t * strength;
      vec3 sc;
      if (u_gradientType == 0) sc = meshGradient(sampleUV, time);
      else if (u_gradientType == 1) sc = radialGradient(sampleUV, time);
      else if (u_gradientType == 2) sc = linearGradient(sampleUV, time);
      else if (u_gradientType == 3) sc = conicGradient(sampleUV, time);
      else sc = plasmaGradient(sampleUV, time);
      color += sc;
    }
    color /= float(SAMPLES);
  } else {
    if (u_gradientType == 0) color = meshGradient(uv, time);
    else if (u_gradientType == 1) color = radialGradient(uv, time);
    else if (u_gradientType == 2) color = linearGradient(uv, time);
    else if (u_gradientType == 3) color = conicGradient(uv, time);
    else color = plasmaGradient(uv, time);
  }

  // Noise overlay
  if (u_noiseEnabled) {
    float n = snoise(uv * u_noiseScale * 10.0 + time * 0.5) * 0.5 + 0.5;
    color = mix(color, color * (0.5 + n), u_noiseIntensity);
  }

  // Particles
  if (u_particlesEnabled) {
    float p = renderParticles(uv, u_time);
    vec3 particleColor = getGradientColor(uv.x * 0.5 + uv.y * 0.5);
    color += particleColor * p * 0.6;
  }

  // Bloom (simplified single-pass glow)
  if (u_bloomEnabled) {
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float bloomMask = smoothstep(0.6, 1.0, luminance);
    color += color * bloomMask * u_bloomIntensity;
  }

  // Chromatic aberration (before color adjustments for maximum effect)
  if (u_chromaticAberration > 0.001) {
    vec2 center = vec2(0.5);
    vec2 dir = uv - center;
    float caOffset = u_chromaticAberration * 0.01;
    // Re-sample R and B channels at offset UVs
    vec2 uvR = uv + dir * caOffset;
    vec2 uvB = uv - dir * caOffset;
    float rSample, bSample;
    // Sample red channel from offset position
    vec3 cR;
    if (u_gradientType == 0) cR = meshGradient(uvR, time);
    else if (u_gradientType == 1) cR = radialGradient(uvR, time);
    else if (u_gradientType == 2) cR = linearGradient(uvR, time);
    else if (u_gradientType == 3) cR = conicGradient(uvR, time);
    else cR = plasmaGradient(uvR, time);
    vec3 cB;
    if (u_gradientType == 0) cB = meshGradient(uvB, time);
    else if (u_gradientType == 1) cB = radialGradient(uvB, time);
    else if (u_gradientType == 2) cB = linearGradient(uvB, time);
    else if (u_gradientType == 3) cB = conicGradient(uvB, time);
    else cB = plasmaGradient(uvB, time);
    color = vec3(cR.r, color.g, cB.b);
  }

  // Hue shift
  if (abs(u_hueShift) > 0.01) {
    color = rotateHue(color, u_hueShift * 6.28318 / 360.0);
  }

  // Saturation
  color = adjustSaturation(color, u_saturation);

  // Brightness
  color *= u_brightness;

  // Vignette
  if (u_vignette > 0.0) {
    float vig = length(uv - 0.5) * 1.414;
    vig = smoothstep(0.5, 1.2, vig);
    color *= 1.0 - vig * u_vignette;
  }

  // Film grain
  if (u_grain > 0.0) {
    float grainNoise = hash(uv * u_resolution + fract(u_time * 100.0)) * 2.0 - 1.0;
    color += grainNoise * u_grain * 0.15;
  }

  // Tone mapping (simple reinhard)
  color = color / (color + 1.0);

  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
