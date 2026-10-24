#version 300 es
precision highp float;
precision highp sampler2D;

// Cinematic bloom, down the pyramid: each level is the one above at half the
// size, through the 13-tap filter of Jimenez's "Next Generation Post Processing
// in Call of Duty: Advanced Warfare" (a box of boxes: smooth enough that the
// chain neither aliases nor flickers as the picture moves). The first pass
// reads the composited scene, converts it to linear light and keeps only the
// light above a soft threshold; the levels below are that light, ever wider.

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_source;
uniform vec2 u_sourceTexel;   // 1 / the source texture's size
uniform vec2 u_sourceScale;   // the share of the source holding the picture (the scene's drawn corner at a reduced render scale), else 1
uniform float u_threshold;    // first pass: linear light below this does not bloom; 0 = pass everything (the lower levels)

vec3 tap(vec2 uv) {
  vec2 halfTexel = 0.5 * u_sourceTexel;
  return textureLod(u_source, clamp(uv * u_sourceScale, halfTexel, u_sourceScale - halfTexel), 0.0).rgb;
}

void main() {
  vec2 o = u_sourceTexel / u_sourceScale;
  vec3 a = tap(v_uv + o * vec2(-2.0, 2.0));
  vec3 b = tap(v_uv + o * vec2(0.0, 2.0));
  vec3 c = tap(v_uv + o * vec2(2.0, 2.0));
  vec3 d = tap(v_uv + o * vec2(-2.0, 0.0));
  vec3 e = tap(v_uv);
  vec3 f = tap(v_uv + o * vec2(2.0, 0.0));
  vec3 g = tap(v_uv + o * vec2(-2.0, -2.0));
  vec3 h = tap(v_uv + o * vec2(0.0, -2.0));
  vec3 i = tap(v_uv + o * vec2(2.0, -2.0));
  vec3 j = tap(v_uv + o * vec2(-1.0, 1.0));
  vec3 k = tap(v_uv + o * vec2(1.0, 1.0));
  vec3 l = tap(v_uv + o * vec2(-1.0, -1.0));
  vec3 m = tap(v_uv + o * vec2(1.0, -1.0));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;

  if (u_threshold > 0.0) {
    // The scene is display sRGB; light spreads in linear light.
    col = mix(col / 12.92, pow((max(col, 0.0) + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), col));
    // Quadratic soft knee: no hard line where light starts to bloom.
    float bright = max(max(col.r, col.g), col.b);
    float knee = 0.5 * u_threshold;
    float soft = clamp(bright - u_threshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee);
    col *= max(soft, bright - u_threshold) / max(bright, 1e-5);
  }
  fragColor = vec4(col, 1.0);
}
