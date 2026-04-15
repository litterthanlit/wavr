#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform int u_trailPass; // 0=decay previous, 1=draw circle
uniform sampler2D u_trailPrev;
uniform float u_trailDecay;
uniform vec2 u_trailMouse;
uniform float u_trailWidth;

void main() {
  if (u_trailPass == 0) {
    // Decay pass: fade the previous trail
    vec4 prev = texture(u_trailPrev, v_uv);
    fragColor = prev * u_trailDecay;
  } else {
    // Draw pass: soft circle at mouse position
    float dist = length(v_uv - u_trailMouse);
    float circle = smoothstep(u_trailWidth, u_trailWidth * 0.3, dist);
    fragColor = vec4(vec3(circle), circle);
  }
}
