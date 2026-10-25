#version 300 es
precision highp float;
precision highp sampler2D;

// HDR output, packing: the post pass's extended-range frame as two 8-bit
// frames, which is all a WebGL canvas can hand on (hdr-output.ts copies each
// to WebGPU, which decodes them onto an extended-range canvas). Each channel,
// 0 to u_range (the peak's display value), is quantized to 12 bits: tile 0
// holds the high 8 bits of red, green and blue, tile 1 their low 4 bits (red
// and green in its red byte, blue in its green byte) and the alpha. Both are
// opaque: the canvas premultiplies a pixel that is not, which loses its bits.

out vec4 fragColor;

uniform sampler2D u_source;  // the frame, RGBA16F, the size of the canvas
uniform float u_range;       // the display value 4095 stands for
uniform int u_tile;          // 0 or 1

void main() {
  vec4 c = texelFetch(u_source, ivec2(gl_FragCoord.xy), 0);
  vec3 q = floor(clamp(c.rgb / u_range, 0.0, 1.0) * 4095.0 + 0.5);
  vec3 hi = floor(q / 16.0);
  vec3 lo = q - 16.0 * hi;
  if (u_tile == 0) {
    fragColor = vec4(hi / 255.0, 1.0);
  } else {
    fragColor = vec4((16.0 * lo.r + lo.g) / 255.0, 16.0 * lo.b / 255.0, clamp(c.a, 0.0, 1.0), 1.0);
  }
}
