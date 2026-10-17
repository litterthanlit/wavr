// ============================================================
// Physics-based Mouse Displacement
// ============================================================

// Fluid displacement: pushes UV coords away from mouse like a finger in water
vec2 fluidDisplace(vec2 uv, float strength) {
  vec2 toPixel = uv - u_mouseSmooth;
  float dist = length(toPixel);
  float radius = 0.5 + strength * 0.3; // much larger influence zone

  // Cubic falloff — strong near center, long soft tail
  float influence = smoothstep(radius, 0.0, dist);
  influence = influence * influence * (3.0 - 2.0 * influence); // hermite smoothstep

  // Push away from mouse — much stronger displacement
  vec2 pushDir = normalize(toPixel + 0.0001);
  float pushAmount = influence * 0.25 * strength;

  // Velocity drag: fast mouse movement drags the gradient behind it
  float speed = length(u_mouseVelocity);
  vec2 velDrag = u_mouseVelocity * 0.015 * strength * influence;
  // Speed amplifies the effect: faster = bigger wake
  velDrag *= (1.0 + speed * 0.002);

  return uv + pushDir * pushAmount + velDrag;
}

// Vortex swirl: rotates UV around mouse position
vec2 vortexDisplace(vec2 uv, float strength) {
  vec2 toPixel = uv - u_mouseSmooth;
  float dist = length(toPixel);
  float radius = 0.6 + strength * 0.2;

  float influence = smoothstep(radius, 0.0, dist);
  float speed = length(u_mouseVelocity);
  // Swirl angle scales with speed — fast movement = strong vortex
  float angle = influence * (1.0 + speed * 0.02) * strength;

  float s = sin(angle);
  float c = cos(angle);
  vec2 rotated = vec2(toPixel.x * c - toPixel.y * s, toPixel.x * s + toPixel.y * c);

  return u_mouseSmooth + rotated;
}

// Ripple: creates expanding wave rings from mouse
float rippleEffect(vec2 uv, float time) {
  float dist = length(uv - u_mouseSmooth);
  float speed = length(u_mouseVelocity);
  // Larger reach, stronger waves, speed-responsive
  float rippleStr = smoothstep(0.8, 0.0, dist) * (0.5 + speed * 0.01);
  return sin(dist * 20.0 - time * 5.0) * rippleStr;
}

// Magnet pull: attracts UV coords toward mouse position
vec2 magnetDisplace(vec2 uv, float strength) {
  vec2 toMouse = u_mouseSmooth - uv;
  float dist = length(toMouse);
  float radius = 0.5 + strength * 0.3;

  float influence = smoothstep(radius, 0.0, dist);
  influence *= influence;

  // Pull toward mouse — opposite of fluid
  vec2 pull = toMouse * influence * 0.2 * strength;
  // Velocity creates directional smear
  float speed = length(u_mouseVelocity);
  vec2 smear = u_mouseVelocity * 0.012 * influence * strength;

  return uv + pull + smear;
}

// Gravity warp: bends space around mouse like a gravitational lens
vec2 gravityDisplace(vec2 uv, float strength) {
  vec2 toPixel = uv - u_mouseSmooth;
  float dist = length(toPixel);
  float radius = 0.6 + strength * 0.2;

  // Inverse-square-ish falloff for gravitational feel
  float influence = 1.0 / (1.0 + dist * dist * 20.0 / (strength * strength + 0.01));
  influence *= smoothstep(radius, radius * 0.3, dist); // cut off at distance

  // Tangential deflection (like light bending around a mass)
  vec2 tangent = vec2(-toPixel.y, toPixel.x);
  float speed = length(u_mouseVelocity);
  float spin = (0.3 + speed * 0.01) * strength;

  return uv + tangent * influence * spin * 0.15;
}
