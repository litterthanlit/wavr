#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;
out vec2 v_uv;

// Mesh distortion uniforms (Phase 7)
uniform bool u_meshEnabled;
uniform float u_meshDisplacement;
uniform float u_meshFrequency;
uniform float u_meshSpeed;
uniform float u_time;
uniform mat4 u_mvp;
uniform vec2 u_mouseSmooth;
uniform float u_mousePresence;
uniform float u_mouseReact;
uniform vec2 u_resolution;

// Cheap sin-based noise (v1 — upgrade to simplex later)
float cheapNoise(vec2 p, float freq) {
  return sin(p.x * freq * 3.14159) * sin(p.y * freq * 3.14159 * 1.3)
       + sin(p.x * freq * 2.17 + 1.7) * sin(p.y * freq * 1.87 + 2.3) * 0.5;
}

void main() {
  // UV derived from position — clamp for oversized grid (1.1×)
  v_uv = clamp(a_position * 0.5 + 0.5, 0.0, 1.0);

  if (u_meshEnabled) {
    vec3 pos = vec3(a_position, 0.0);

    // Animated noise displacement along +Z
    float animOffset = u_time * u_meshSpeed;
    float disp = cheapNoise(pos.xy + animOffset, u_meshFrequency) * 0.5;

    // Mouse-reactive: vertices under the pointer get extra displacement. The
    // distance is measured on screen, from where the undisplaced vertex lands
    // to the pointer, in aspect-correct canvas heights, so the lift is a circle
    // under the cursor whatever the camera does. The falloff is C1 and reaches
    // exactly zero, and presence scales it so nothing lifts while the pointer
    // is away.
    vec4 flatClip = u_mvp * vec4(pos.xy, 0.0, 1.0);
    vec2 toMouse = (flatClip.xy / flatClip.w - (u_mouseSmooth * 2.0 - 1.0))
                 * vec2(u_resolution.x / u_resolution.y, 1.0) * 0.5;
    float reach = max(1.0 - dot(toMouse, toMouse) / (0.3 * 0.3), 0.0);
    float mouseInfluence = reach * reach * u_mouseReact * u_mousePresence;

    pos.z = (disp + mouseInfluence * 0.3) * u_meshDisplacement;

    gl_Position = u_mvp * vec4(pos, 1.0);
  } else {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
}
