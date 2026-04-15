#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_source;
uniform float u_threshold;

void main() {
  vec3 color = texture(u_source, v_uv).rgb;
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float contribution = max(lum - u_threshold, 0.0) / max(lum, 0.001);
  fragColor = vec4(color * contribution, 1.0);
}
