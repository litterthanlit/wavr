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
uniform int u_gradientType; // 0=mesh, 1=radial, 2=linear, 3=conic, 4=plasma, 5=dither, 6=scanline, 7=glitch
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
uniform float u_mouseReact;
uniform bool u_bloomEnabled;
uniform float u_bloomIntensity;
uniform float u_vignette;
uniform float u_radialBlurAmount;
uniform bool u_blurEnabled;
uniform float u_blurAmount;
uniform float u_colorBlend;
uniform float u_chromaticAberration;
uniform float u_hueShift;
uniform bool u_asciiEnabled;
uniform float u_asciiSize;
uniform bool u_ditherEnabled;
uniform float u_ditherSize;
uniform float u_layerOpacity;
uniform bool u_isBaseLayer;

// Advanced effects
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
uniform float u_domainWarp;
uniform bool u_feedbackEnabled;
uniform float u_feedbackDecay;
uniform sampler2D u_prevFrame;

// Image / texture
uniform sampler2D u_imageTexture;
uniform sampler2D u_distortionMap;
uniform float u_hasImage;
uniform float u_hasDistortionMap;
uniform float u_imageScale;
uniform vec2 u_imageOffset;
uniform float u_distortionMapIntensity;
uniform int u_imageBlendMode;  // 0=replace, 1=normal, 2=multiply, 3=screen, 4=overlay
uniform float u_imageBlendOpacity;

// Mask
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

// Text mask
uniform float u_textMaskEnabled;
uniform sampler2D u_textMaskTexture;

// Custom GLSL
uniform bool u_customEnabled;

// Parallax depth (Phase 7)
uniform bool u_parallaxEnabled;
uniform float u_parallaxStrength;
uniform float u_layerDepth;

// 3D Shape Projection (Phase 7)
uniform bool u_3dEnabled;
uniform int u_3dShape;           // 0=sphere, 1=torus, 2=plane, 3=cylinder, 4=cube
uniform float u_3dPerspective;   // 0.5-3.0
uniform float u_3dRotationSpeed;
uniform vec2 u_3dRotation;       // accumulated rotation (azimuth, elevation)
uniform float u_3dZoom;          // 0.5-2.0
uniform float u_3dLighting;      // 0.0-1.0

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

// ============================================================
// 3D SDF Functions (Phase 7)
// ============================================================

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float sdPlane(vec3 p) {
  return p.y;
}

float sdCylinder(vec3 p, float h, float r) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sceneSDF(vec3 p) {
  if (u_3dShape == 0) return sdSphere(p, 0.8);
  else if (u_3dShape == 1) return sdTorus(p, vec2(0.6, 0.25));
  else if (u_3dShape == 2) return sdPlane(p + vec3(0.0, 0.3, 0.0));
  else if (u_3dShape == 3) return sdCylinder(p, 0.8, 0.5);
  else return sdBox(p, vec3(0.6));
}

vec3 calcNormal(vec3 p) {
  const float h = 0.001;
  return normalize(vec3(
    sceneSDF(p + vec3(h, 0, 0)) - sceneSDF(p - vec3(h, 0, 0)),
    sceneSDF(p + vec3(0, h, 0)) - sceneSDF(p - vec3(0, h, 0)),
    sceneSDF(p + vec3(0, 0, h)) - sceneSDF(p - vec3(0, 0, h))
  ));
}

vec2 mapToUV(vec3 p, vec3 n) {
  if (u_3dShape == 0) {
    // Sphere: spherical coordinates
    float u = atan(p.z, p.x) / 6.28318 + 0.5;
    float v = asin(clamp(p.y / 0.8, -1.0, 1.0)) / 3.14159 + 0.5;
    return vec2(u, v);
  } else if (u_3dShape == 1) {
    // Torus: angle around ring + angle around tube
    float u = atan(p.z, p.x) / 6.28318 + 0.5;
    vec2 q = vec2(length(p.xz) - 0.6, p.y);
    float v = atan(q.y, q.x) / 6.28318 + 0.5;
    return vec2(u, v);
  } else if (u_3dShape == 2) {
    // Plane: XZ position
    return p.xz * 0.5 + 0.5;
  } else if (u_3dShape == 3) {
    // Cylinder: angle + height
    float u = atan(p.z, p.x) / 6.28318 + 0.5;
    float v = p.y * 0.5 + 0.5;
    return vec2(u, v);
  } else {
    // Box: planar projection based on dominant normal axis
    vec3 an = abs(n);
    if (an.x > an.y && an.x > an.z) return p.yz * 0.8 + 0.5;
    else if (an.y > an.z) return p.xz * 0.8 + 0.5;
    else return p.xy * 0.8 + 0.5;
  }
}

mat3 rotationMatrix(float azimuth, float elevation) {
  float ca = cos(azimuth), sa = sin(azimuth);
  float ce = cos(elevation), se = sin(elevation);
  return mat3(
    ca,  sa * se, sa * ce,
    0.0, ce,      -se,
    -sa, ca * se, ca * ce
  );
}

// Returns: xy=surfaceUV, z=shadeFactor, w=hit (0=miss, 1=hit)
vec4 raymarched3D(vec2 screenUV) {
  float fov = u_3dPerspective;
  vec2 uv = (screenUV - 0.5) * 2.0;
  uv.x *= u_resolution.x / u_resolution.y;

  vec3 ro = vec3(0.0, 0.0, 2.5 / u_3dZoom);
  vec3 rd = normalize(vec3(uv / fov, -1.0));

  mat3 rot = rotationMatrix(u_3dRotation.x, u_3dRotation.y);
  ro = rot * ro;
  rd = rot * rd;

  float t = 0.0;
  float hit = -1.0;
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * t;
    float d = sceneSDF(p);
    if (d < 0.001) { hit = t; break; }
    if (t > 10.0) break;
    t += d;
  }

  if (hit < 0.0) return vec4(0.0);

  vec3 p = ro + rd * hit;
  vec3 n = calcNormal(p);
  vec2 surfaceUV = mapToUV(p, n);

  vec3 lightDir = normalize(vec3(0.5, 0.8, 0.6));
  float diffuse = max(dot(n, lightDir), 0.0);
  float specular = pow(max(dot(reflect(-lightDir, n), normalize(-rd)), 0.0), 32.0);
  float ambient = 0.3;
  float lit = ambient + (diffuse * 0.6 + specular * 0.4) * u_3dLighting;
  float shade = mix(1.0, lit, u_3dLighting);

  return vec4(surfaceUV, shade, 1.0);
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

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

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
// Dither / Halftone Gradient
// ============================================================

vec3 ditherGradient(vec2 uv, float time) {
  // Mouse: fluid displacement
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = fluidDisplace(p, u_mouseReact);
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
    cp = fluidDisplace(cp, u_mouseReact);
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
  return mix(bgColor, dotColor, dot);
}

// ============================================================
// Scanline / CRT Gradient
// ============================================================

vec3 scanlineGradient(vec2 uv, float time) {
  // Mouse: fluid displacement
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = fluidDisplace(p, u_mouseReact);
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

// ============================================================
// Glitch / Data Drag Gradient
// ============================================================

vec3 glitchGradient(vec2 uv, float time) {
  // Mouse: fluid displacement
  vec2 p = uv;
  if (u_mouseReact > 0.0) {
    p = fluidDisplace(p, u_mouseReact);
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

// ============================================================
// Image Gradient (type 8) — samples uploaded texture
// ============================================================

vec3 imageGradient(vec2 uv, float time) {
  vec2 imgUV = (uv - 0.5) / u_imageScale + 0.5 + u_imageOffset;

  // Apply mouse displacement before sampling
  if (u_mouseReact > 0.01) {
    vec2 mouseDir = imgUV - u_mouseSmooth;
    float mouseDist = length(mouseDir);
    float mouseRadius = 0.35 * u_mouseReact;
    if (mouseDist < mouseRadius) {
      float strength = (1.0 - mouseDist / mouseRadius);
      strength *= strength;
      vec2 vel = u_mouseVelocity;
      imgUV += (mouseDir / (mouseDist + 0.001)) * strength * 0.05 * u_mouseReact;
      imgUV += vel * strength * 0.01;
    }
  }

  return texture(u_imageTexture, clamp(imgUV, 0.0, 1.0)).rgb;
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

// ============================================================
// Gradient Dispatch Helper
// ============================================================

// Custom GLSL placeholder — replaced by engine when user provides custom code
vec3 customGradient(vec2 uv, float time) {
  return meshGradient(uv, time); // fallback
}

vec3 computeGradient(vec2 uv, float time) {
  if (u_customEnabled) return customGradient(uv, time);
  if (u_gradientType == 0) return meshGradient(uv, time);
  else if (u_gradientType == 1) return radialGradient(uv, time);
  else if (u_gradientType == 2) return linearGradient(uv, time);
  else if (u_gradientType == 3) return conicGradient(uv, time);
  else if (u_gradientType == 4) return plasmaGradient(uv, time);
  else if (u_gradientType == 5) return ditherGradient(uv, time);
  else if (u_gradientType == 6) return scanlineGradient(uv, time);
  else if (u_gradientType == 7) return glitchGradient(uv, time);
  else return imageGradient(uv, time);
}

// ============================================================
// Main
// ============================================================

void main() {
  vec2 uv = v_uv;
  float time = u_time * u_speed;

  // Parallax depth offset (applied first — shifts entire layer)
  if (u_parallaxEnabled) {
    vec2 offset = u_mouseSmooth * u_layerDepth * u_parallaxStrength * 0.05;
    offset.x *= u_resolution.y / u_resolution.x; // aspect ratio correction
    uv = fract(uv + offset); // wrap for seamless edges
  }

  // Distortion map UV displacement (applied first, chains with everything)
  if (u_hasDistortionMap > 0.5) {
    vec2 distSample = texture(u_distortionMap, uv).rg;
    uv += (distSample - 0.5) * u_distortionMapIntensity;
  }

  // Curl noise UV distortion (fluid-like swirling)
  if (u_curlEnabled) {
    vec2 curl = curlNoise(uv * u_curlScale * 3.0, time);
    uv += curl * u_curlIntensity * 0.1;
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

  // Base gradient (with optional radial zoom blur)
  vec3 color;
  if (u_radialBlurAmount > 0.001) {
    vec2 center = vec2(0.5);
    vec2 dir = uv - center;
    float strength = u_radialBlurAmount * 0.02;
    const int SAMPLES = 12;
    color = vec3(0.0);
    for (int s = 0; s < SAMPLES; s++) {
      float t = float(s) / float(SAMPLES - 1) - 0.5;
      color += computeGradient(uv - dir * t * strength, time);
    }
    color /= float(SAMPLES);
  } else {
    color = computeGradient(uv, time);
  }

  // Image blend over procedural gradient (when type != image but image is uploaded)
  if (u_hasImage > 0.5 && u_gradientType != 8) {
    vec2 imgUV = (uv - 0.5) / u_imageScale + 0.5 + u_imageOffset;
    vec4 imgSample = texture(u_imageTexture, clamp(imgUV, 0.0, 1.0));
    vec3 imgColor = imgSample.rgb;
    float imgAlpha = imgSample.a * u_imageBlendOpacity;

    if (u_imageBlendMode == 0) color = imgColor;
    else if (u_imageBlendMode == 1) color = mix(color, imgColor, imgAlpha);
    else if (u_imageBlendMode == 2) color = mix(color, color * imgColor, imgAlpha);
    else if (u_imageBlendMode == 3) color = mix(color, 1.0 - (1.0 - color) * (1.0 - imgColor), imgAlpha);
    else if (u_imageBlendMode == 4) {
      vec3 ov = mix(2.0 * color * imgColor,
                    1.0 - 2.0 * (1.0 - color) * (1.0 - imgColor),
                    step(0.5, color));
      color = mix(color, ov, imgAlpha);
    }
  }

  // Noise overlay
  if (u_noiseEnabled) {
    float n = snoise(uv * u_noiseScale * 10.0 + time * 0.5) * 0.5 + 0.5;
    color = mix(color, color * (0.5 + n), u_noiseIntensity);
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

  // Chromatic aberration (splits R/B channels of the composed gradient)
  if (u_chromaticAberration > 0.001) {
    vec2 center = vec2(0.5);
    vec2 dir = uv - center;
    float caOffset = u_chromaticAberration * 0.01;
    vec3 cR = computeGradient(uv + dir * caOffset, time);
    vec3 cB = computeGradient(uv - dir * caOffset, time);
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

  // Bloom (after color adjustments so highlights match final palette)
  if (u_bloomEnabled) {
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float bloomMask = smoothstep(0.6, 1.0, luminance);
    color += color * bloomMask * u_bloomIntensity;
  }

  // Vignette
  if (u_vignette > 0.0) {
    float vig = length(uv - 0.5) * 1.414;
    vig = smoothstep(0.5, 1.2, vig);
    color *= 1.0 - vig * u_vignette;
  }

  // Gaussian blur (9-tap weighted kernel — blurs gradient, not pixel effects)
  if (u_blurEnabled && u_blurAmount > 0.0) {
    float px = u_blurAmount / u_resolution.x;
    float py = u_blurAmount / u_resolution.y;
    vec3 sum = color * 4.0;
    sum += computeGradient(uv + vec2(px, 0.0), time) * 2.0;
    sum += computeGradient(uv - vec2(px, 0.0), time) * 2.0;
    sum += computeGradient(uv + vec2(0.0, py), time) * 2.0;
    sum += computeGradient(uv - vec2(0.0, py), time) * 2.0;
    sum += computeGradient(uv + vec2(px, py), time);
    sum += computeGradient(uv - vec2(px, py), time);
    sum += computeGradient(uv + vec2(px, -py), time);
    sum += computeGradient(uv - vec2(px, -py), time);
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

  // Film grain
  if (u_grain > 0.0) {
    float grainNoise = hash(uv * u_resolution + fract(u_time * 100.0)) * 2.0 - 1.0;
    color += grainNoise * u_grain * 0.15;
  }

  // Tone mapping (simple reinhard)
  color = color / (color + 1.0);

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
      // Re-sample gradient at displaced position
      vec2 sortedUV = uv + vec2(offset, 0.0);
      sortedUV.x = clamp(sortedUV.x, 0.0, 1.0);
      vec3 sortedColor = computeGradient(sortedUV, time);
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

  // 3D Shape Projection (raymarching)
  if (u_3dEnabled) {
    vec4 projected = raymarched3D(v_uv);
    if (projected.a > 0.0) {
      // projected.xy = surface UV, projected.z = shade factor
      vec3 surfaceColor = computeGradient(projected.xy, time);
      color = surfaceColor * projected.z;
    } else {
      discard;
    }
  }

  // Shape mask (applied after all effects)
  float mask = computeMask(v_uv, u_time * u_speed);

  // Text mask (overrides shape mask when enabled)
  if (u_textMaskEnabled > 0.5) {
    mask = texture(u_textMaskTexture, v_uv).r;
  }

  fragColor = vec4(clamp(color, 0.0, 1.0), u_layerOpacity * mask);
}
