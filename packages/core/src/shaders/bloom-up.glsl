#version 300 es
precision highp float;
precision highp sampler2D;

// Cinematic bloom, up the pyramid: a level, blurred by a 3x3 tent and scaled
// by u_weight, is added (blending ONE, ONE) to the level above it, so the top
// level ends up holding every level's light, each spread twice as wide as the
// one before and a little fainter: a long, smooth glare falloff, as a lens
// gives, from a few cheap passes.

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_source;
uniform vec2 u_sourceTexel;   // 1 / the source level's size
uniform float u_weight;       // how much of the wider level's light reaches this one

void main() {
  vec2 o = u_sourceTexel;
  vec3 col = textureLod(u_source, v_uv, 0.0).rgb * 4.0;
  col += (textureLod(u_source, v_uv + vec2(o.x, 0.0), 0.0).rgb + textureLod(u_source, v_uv - vec2(o.x, 0.0), 0.0).rgb
        + textureLod(u_source, v_uv + vec2(0.0, o.y), 0.0).rgb + textureLod(u_source, v_uv - vec2(0.0, o.y), 0.0).rgb) * 2.0;
  col += textureLod(u_source, v_uv + o, 0.0).rgb + textureLod(u_source, v_uv - o, 0.0).rgb
       + textureLod(u_source, v_uv + vec2(o.x, -o.y), 0.0).rgb + textureLod(u_source, v_uv + vec2(-o.x, o.y), 0.0).rgb;
  fragColor = vec4(col * (u_weight / 16.0), 1.0);
}
