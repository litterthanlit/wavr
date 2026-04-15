#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_source;
uniform vec2 u_direction; // (1/w, 0) for horizontal, (0, 1/h) for vertical

void main() {
  // 9-tap Gaussian kernel (sigma ~2.5)
  // Weights: 0.0625, 0.0938, 0.1563, 0.1875, 0.1875, 0.1563, 0.0938, 0.0625
  // Symmetrical so we sample center + 4 on each side
  vec3 result = texture(u_source, v_uv).rgb * 0.2270270270;
  result += texture(u_source, v_uv + u_direction * 1.0).rgb * 0.1945945946;
  result += texture(u_source, v_uv - u_direction * 1.0).rgb * 0.1945945946;
  result += texture(u_source, v_uv + u_direction * 2.0).rgb * 0.1216216216;
  result += texture(u_source, v_uv - u_direction * 2.0).rgb * 0.1216216216;
  result += texture(u_source, v_uv + u_direction * 3.0).rgb * 0.0540540541;
  result += texture(u_source, v_uv - u_direction * 3.0).rgb * 0.0540540541;
  result += texture(u_source, v_uv + u_direction * 4.0).rgb * 0.0162162162;
  result += texture(u_source, v_uv - u_direction * 4.0).rgb * 0.0162162162;
  fragColor = vec4(result, 1.0);
}
