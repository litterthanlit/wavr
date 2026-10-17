#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

// Pointer trail: an energy field (R) at a fraction of the canvas size. Each
// step the previous field decays and the pointer stamps a soft line from where
// it was to where it is, so fast moves leave a continuous streak instead of
// dots. post.glsl turns the field into a lift and a refraction of the picture.
uniform sampler2D u_trailPrev;
uniform float u_trailDecay;   // pow(trailLength, dt * 60): frame-rate independent
uniform float u_trailFloor;   // subtracted each step so 8-bit energy reaches zero instead of stalling
uniform vec2 u_trailFrom;     // pointer at the previous step, uv
uniform vec2 u_trailTo;       // pointer now, uv
uniform float u_trailWidth;   // stamp radius, canvas heights
uniform float u_trailAspect;  // canvas width / height
uniform float u_trailStamp;   // stamp strength 0..1: presence, and more with speed

void main() {
  float energy = max(texture(u_trailPrev, v_uv).r * u_trailDecay - u_trailFloor, 0.0);

  // Distance in aspect-correct space (canvas heights) to the segment, so the
  // stamp is a round capsule.
  vec2 aspect = vec2(u_trailAspect, 1.0);
  vec2 a = u_trailFrom * aspect;
  vec2 ab = u_trailTo * aspect - a;
  vec2 p = v_uv * aspect;
  float along = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
  float reach = length(p - (a + ab * along)) / u_trailWidth;
  float falloff = max(1.0 - reach * reach, 0.0); // C1: (1 - r^2)^2, exactly zero at r = 1
  energy = max(energy, u_trailStamp * falloff * falloff);

  fragColor = vec4(energy, energy, energy, 1.0);
}
