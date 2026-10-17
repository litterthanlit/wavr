// Layer program: renders one layer. Needs common.glsl, mouse.glsl, gradients.glsl
// (and hsl.glsl + blend-modes.glsl for compositing) ahead of it.

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

// ============================================================
// Main — one layer
// ============================================================

// Per-layer work only: parallax, distortion map, 3D projection, the gradient
// (a single call to computeGradient, so it is inlined once), image blend, mask,
// opacity and compositing over the previous layers. Global effects are
// post.glsl's job.
void main() {
  vec2 uv = v_uv;
  float time = u_time * u_speed;
  float shade = 1.0;

  // Parallax depth offset (applied first — shifts entire layer)
  if (u_parallaxEnabled) {
    vec2 offset = u_mouseSmooth * u_layerDepth * u_parallaxStrength * 0.05;
    offset.x *= u_resolution.y / u_resolution.x; // aspect ratio correction
    uv = fract(uv + offset); // wrap for seamless edges
  }

  // Distortion map UV displacement
  if (u_hasDistortionMap > 0.5) {
    vec2 distSample = texture(u_distortionMap, uv).rg;
    uv += (distSample - 0.5) * u_distortionMapIntensity;
  }

  // 3D Shape Projection (raymarching): the gradient is sampled at the surface
  // UV instead, so find that before evaluating it.
  if (u_3dEnabled) {
    vec4 projected = raymarched3D(v_uv);
    if (projected.a <= 0.0) discard;
    // projected.xy = surface UV, projected.z = shade factor
    uv = projected.xy;
    shade = projected.z;
  }

  vec3 color = computeGradient(uv, time) * shade;

#if WAVR_GRADIENT != 8
  // Image blend over procedural gradient (when type != image but image is
  // uploaded). The 3D projection replaces the flat image, as it always has.
  if (u_hasImage > 0.5 && !u_3dEnabled) {
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
#endif

  // Shape mask
  float mask = computeMask(v_uv, u_time * u_speed);

  // Text mask (overrides shape mask when enabled)
  if (u_textMaskEnabled > 0.5) {
    mask = texture(u_textMaskTexture, v_uv).r;
  }

  vec3 layerColor = clamp(color, 0.0, 1.0);
  float layerAlpha = u_layerOpacity * mask;

  if (u_compositeEnabled) {
    vec3 base = texture(u_compositePrev, compositeUV(v_uv, vec2(textureSize(u_compositePrev, 0)))).rgb;
    vec3 blended = dispatchBlend(base, layerColor, u_blendMode);
    fragColor = vec4(mix(base, blended, layerAlpha), 1.0);
  } else {
    fragColor = vec4(layerColor, layerAlpha);
  }
}
