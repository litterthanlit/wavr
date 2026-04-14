#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

// Mesh distortion uniforms (Phase 7)
uniform bool u_meshEnabled;
uniform float u_meshDisplacement;
uniform float u_meshFrequency;
uniform float u_meshSpeed;
uniform float u_time;
uniform mat4 u_mvp;
uniform vec2 u_mouseSmooth;
uniform float u_mouseReact;

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

    // Mouse-reactive: vertices near mouse get extra displacement
    vec2 mousePos = u_mouseSmooth * 2.0 - 1.0; // convert 0-1 to -1..1
    float mouseDist = length(pos.xy - mousePos);
    float mouseInfluence = exp(-mouseDist * 3.0) * u_mouseReact;

    pos.z = (disp + mouseInfluence * 0.3) * u_meshDisplacement;

    gl_Position = u_mvp * vec4(pos, 1.0);
  } else {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
}
