export function generateEmbedCode(stateHash: string, width = 800, height = 600): string {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://wavr.app";
  return `<iframe src="${baseUrl}/editor#${stateHash}" width="${width}" height="${height}" frameborder="0" style="border:0;border-radius:8px;" allow="autoplay"></iframe>`;
}

export function exportPNG(canvas: HTMLCanvasElement, filename = "wavr-gradient.png") {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

export function exportCSS(
  colors: [number, number, number][],
  textMask?: { enabled: boolean; content: string; fontSize: number; fontWeight: number; letterSpacing: number; align: string }
): string {
  const hexColors = colors.map(([r, g, b]) => {
    const toHex = (n: number) =>
      Math.round(n * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  });

  const stops = hexColors.join(", ");

  if (textMask?.enabled && textMask.content) {
    return `.wavr-gradient-text {
  background: linear-gradient(135deg, ${stops});
  background-size: 400% 400%;
  animation: wavr-shift 8s ease infinite;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-size: ${textMask.fontSize}px;
  font-weight: ${textMask.fontWeight};
  letter-spacing: ${textMask.letterSpacing}em;
  text-align: ${textMask.align};
}

@keyframes wavr-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}`;
  }

  return `.wavr-gradient {
  background: linear-gradient(135deg, ${stops});
  background-size: 400% 400%;
  animation: wavr-shift 8s ease infinite;
}

@keyframes wavr-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}`;
}

interface EmbedConfig {
  type: number;
  colors: [number, number, number][];
  speed: number;
  complexity: number;
  scale: number;
  distortion: number;
  softness?: number;
  brightness?: number;
  saturation?: number;
  hueShift?: number;
  noiseEnabled?: boolean;
  noiseIntensity?: number;
  noiseScale?: number;
  grain?: number;
  bloomEnabled?: boolean;
  bloomIntensity?: number;
  vignette?: number;
  chromaticAberration?: number;
  domainWarp?: number;
}

export function generateEmbedConfig(state: ExportableState & {
  noiseEnabled?: boolean;
  noiseIntensity?: number;
  noiseScale?: number;
  grain?: number;
  bloomEnabled?: boolean;
  bloomIntensity?: number;
  vignette?: number;
  chromaticAberration?: number;
  hueShift?: number;
  domainWarp?: number;
}): EmbedConfig {
  const typeMap: Record<string, number> = {
    mesh: 0, radial: 1, linear: 2, conic: 3, plasma: 4,
    dither: 5, scanline: 6, glitch: 7, image: 8, voronoi: 9,
    silk: 10, aurora: 11, liquid: 12, softCells: 13, grainflow: 14,
  };

  const config: EmbedConfig = {
    type: typeMap[state.gradientType] ?? 0,
    colors: state.colors.map(c => c.map(v => +v.toFixed(3)) as [number, number, number]),
    speed: +state.speed.toFixed(2),
    complexity: Math.round(state.complexity),
    scale: +state.scale.toFixed(2),
    distortion: +state.distortion.toFixed(2),
  };

  // Only include non-default values to keep config small
  if (state.brightness !== undefined && state.brightness !== 1.0) config.brightness = +state.brightness.toFixed(2);
  if (state.saturation !== undefined && state.saturation !== 1.0) config.saturation = +state.saturation.toFixed(2);
  if (state.hueShift) config.hueShift = Math.round(state.hueShift);
  if (state.noiseEnabled) {
    config.noiseEnabled = true;
    config.noiseIntensity = +(state.noiseIntensity ?? 0.3).toFixed(2);
    config.noiseScale = +(state.noiseScale ?? 1.0).toFixed(2);
  }
  if (state.grain) config.grain = +state.grain.toFixed(2);
  if (state.bloomEnabled) {
    config.bloomEnabled = true;
    config.bloomIntensity = +(state.bloomIntensity ?? 0.3).toFixed(2);
  }
  if (state.vignette) config.vignette = +state.vignette.toFixed(2);
  if (state.chromaticAberration) config.chromaticAberration = +state.chromaticAberration.toFixed(3);
  if (state.domainWarp) config.domainWarp = +state.domainWarp.toFixed(2);
  if (state.softness) config.softness = +state.softness.toFixed(2);

  return config;
}

export function generateEmbedSnippet(config: EmbedConfig): string {
  const json = JSON.stringify(config);
  return `<script src="https://wavr.app/embed.js"></script>\n<wavr-gradient data-config='${json}' style="width:100%;height:400px;display:block"></wavr-gradient>`;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function exportTailwindCSS(colors: [number, number, number][], speed: number): string {
  const hexColors = colors.map(([r, g, b]) => rgbToHex(r, g, b));
  const duration = Math.round(8 / Math.max(speed, 0.1));

  const fromColor = hexColors[0];
  const toColor = hexColors[hexColors.length - 1];
  const viaColor = hexColors.length > 2 ? hexColors[Math.floor(hexColors.length / 2)] : null;

  const gradientClasses = viaColor
    ? `from-[${fromColor}] via-[${viaColor}] to-[${toColor}]`
    : `from-[${fromColor}] to-[${toColor}]`;

  return `<!-- Wavr Gradient — Tailwind CSS -->
<div class="bg-gradient-to-br ${gradientClasses} bg-[length:400%_400%] animate-wavr-shift w-full h-full" />

<!-- Add to your tailwind.config.js -->
<script>
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      animation: {
        'wavr-shift': 'wavr-shift ${duration}s ease infinite',
      },
      keyframes: {
        'wavr-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
}
</script>`;
}

interface ExportableState {
  colors: [number, number, number][];
  gradientType: string;
  speed: number;
  complexity: number;
  scale: number;
  distortion: number;
  softness?: number;
  brightness: number;
  saturation: number;
}

const EXPORT_TYPE_MAP: Record<string, number> = {
  mesh: 0,
  radial: 1,
  linear: 2,
  conic: 3,
  plasma: 4,
  dither: 5,
  scanline: 6,
  glitch: 7,
  image: 8,
  voronoi: 9,
  silk: 10,
  aurora: 11,
  liquid: 12,
  softCells: 13,
  grainflow: 14,
};

const PORTABLE_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

function exportTypeId(type: string): number {
  return EXPORT_TYPE_MAP[type] ?? EXPORT_TYPE_MAP.mesh;
}

function exportNumber(value: number | undefined, fallback: number, digits = 2): string {
  const n = Number.isFinite(value) ? value : fallback;
  return (n ?? fallback).toFixed(digits);
}

function templateLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function exportColorsLiteral(colors: [number, number, number][]): string {
  return colors.map(c => `[${c.map(v => v.toFixed(3)).join(", ")}]`).join(",\n      ");
}

function exportColorsJson(colors: [number, number, number][]): string {
  return JSON.stringify(colors.map(c => c.map(v => +v.toFixed(3))));
}

function portableFragmentShader(state: ExportableState): string {
  const type = exportTypeId(state.gradientType);
  const complexity = Math.max(1, Math.min(8, Math.round(state.complexity)));
  const softness = state.softness ?? 0;

  return `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_colors[8];
uniform int u_colorCount;

const int TYPE = ${type};
const float SPEED = ${exportNumber(state.speed, 0.4)};
const int OCTAVES = ${complexity};
const float SCALE = ${exportNumber(state.scale, 1)};
const float DISTORTION = ${exportNumber(state.distortion, 0.3)};
const float SOFTNESS = ${exportNumber(softness, 0)};
const float BRIGHTNESS = ${exportNumber(state.brightness, 1)};
const float SATURATION = ${exportNumber(state.saturation, 1)};

vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1,0):vec2(0,1);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0,i1.y,1))+i.x+vec3(0,i1.x,1));
  vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);
  m=m*m;m=m*m;
  vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-.5;
  vec3 ox=floor(x+.5);vec3 a0=x-ox;
  m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.*dot(m,g);
}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
vec2 hash22(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
float fbm(vec2 p){
  float v=0.,a=.5,f=1.;
  for(int i=0;i<8;i++){if(i>=OCTAVES)break;v+=a*snoise(p*f);f*=2.;a*=.5;}
  return v;
}
float cells(vec2 p){
  vec2 i=floor(p),f=fract(p);float m=8.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 g=vec2(float(x),float(y));
    vec2 o=hash22(i+g);
    m=min(m,length(g+o-f));
  }
  return m;
}
float liquid(vec2 p,float t){
  float v=0.;
  for(int i=0;i<5;i++){
    float fi=float(i);
    vec2 c=.5+.28*vec2(sin(t*.28+fi*1.7),cos(t*.22+fi*2.1));
    v+=.055/(length(p-c)+.045);
  }
  return smoothstep(.3,1.25,v);
}
float fieldFor(vec2 uv,float t){
  vec2 p=(uv-.5)*SCALE+.5;
  vec2 warp=vec2(fbm(p*1.7+t*.08),fbm(p*1.7-t*.07));
  vec2 q=p+(warp-.5)*DISTORTION;
  if(TYPE==1)return smoothstep(.05,1.05,length(q-.5)*1.45);
  if(TYPE==2)return fract(q.x*.75+q.y*.35+t*.05+fbm(q)*.2);
  if(TYPE==3)return fract(atan(q.y-.5,q.x-.5)/6.28318+length(q-.5)*.55+t*.04);
  if(TYPE==4)return .5+.5*sin((q.x+q.y)*6.0+fbm(q*2.2)*4.0+t);
  if(TYPE==5)return floor((fbm(q*3.0+t*.1)*.5+.5)*9.0)/8.0;
  if(TYPE==6)return fract(q.y*18.0+t*.2+fbm(q*2.0)*.18);
  if(TYPE==7)return fract(q.x+floor(q.y*16.0)*.13+step(.7,hash(vec2(floor(q.y*16.0),floor(t*6.0))))*.18);
  if(TYPE==9)return smoothstep(.08,.72,cells(q*4.5+t*.08));
  if(TYPE==10){
    float r=sin((q.x+fbm(q*1.4+t*.05)*DISTORTION)*7.0+q.y*2.0+t*.45);
    return smoothstep(-.85,.85,r);
  }
  if(TYPE==11){
    float curtain=sin(q.x*7.0+fbm(vec2(q.x*1.5,q.y*.8)+t*.06)*5.0+t*.35);
    float lift=smoothstep(.08,.9,q.y);
    return mix(.12,.95,smoothstep(-.65,.9,curtain)*lift);
  }
  if(TYPE==12)return liquid(q,t);
  if(TYPE==13)return smoothstep(.0,1.0,1.0-cells(q*3.4+(warp-.5)*.8));
  if(TYPE==14)return fbm(q*2.7+vec2(t*.12,fbm(q+t*.05))*1.6)*.5+.5;
  return fbm(q*2.0+vec2(t*.12,-t*.08))*.5+.5;
}
vec3 getColor(float t){
  t=clamp(t,0.,1.);float s=t*float(u_colorCount-1);
  int idx=int(floor(s));float f=fract(s);f=f*f*(3.-2.*f);
  int next=min(idx+1,u_colorCount-1);
  return mix(u_colors[idx],u_colors[next],f);
}
vec3 softColor(float t){
  float spread=.02+SOFTNESS*.12;
  vec3 c=getColor(t)*.46;
  c+=getColor(t-spread)*.18+getColor(t+spread)*.18;
  c+=getColor(t-spread*2.)*.09+getColor(t+spread*2.)*.09;
  return c;
}
void main(){
  vec2 aspect=vec2(u_resolution.x/max(u_resolution.y,1.0),1.0);
  vec2 uv=(v_uv-.5)*aspect+.5;
  float time=u_time*SPEED;
  float field=fieldFor(uv,time);
  field=mix(field,smoothstep(.08,.92,field),clamp(SOFTNESS,0.,1.));
  vec3 color=softColor(field);
  if(TYPE==5){
    float dotMask=step(.48,fract((gl_FragCoord.x+gl_FragCoord.y)*.5));
    color*=mix(.88,1.08,dotMask);
  }
  if(TYPE==14){
    float grain=hash(gl_FragCoord.xy+time*60.)-.5;
    color+=grain*(.035+SOFTNESS*.025);
  }
  color*=BRIGHTNESS;
  float grey=dot(color,vec3(.2126,.7152,.0722));
  color=mix(vec3(grey),color,SATURATION);
  color=color/(color+1.);
  fragColor=vec4(clamp(color,0.,1.),1.);
}`;
}

export function exportReactComponent(state: ExportableState): string {
  const colorsStr = exportColorsLiteral(state.colors);
  const fragment = templateLiteral(portableFragmentShader(state));
  const vertex = templateLiteral(PORTABLE_VERTEX_SHADER);

  return `"use client";
import { useEffect, useRef } from "react";

const VERTEX = \`${vertex}\`;

const FRAGMENT = \`${fragment}\`;

interface WavrGradientProps {
  className?: string;
  scrollLinked?: boolean; // Drive animation by scroll position instead of time
}

export default function WavrGradient({ className = "", scrollLinked = false }: WavrGradientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
    if (!gl) return;

    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src); gl!.compileShader(s);
      return s;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(prog); gl.useProgram(prog);

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uRes = gl.getUniformLocation(prog, "u_resolution");
    const uCount = gl.getUniformLocation(prog, "u_colorCount");
    const colors: [number,number,number][] = [
      ${colorsStr}
    ];
    gl.uniform1i(uCount, colors.length);
    for (let i = 0; i < colors.length; i++) {
      const loc = gl.getUniformLocation(prog, \`u_colors[\${i}]\`);
      if (loc) gl.uniform3fv(loc, colors[i]);
    }

    let t = 0, raf = 0, last = performance.now() / 1000;
    let lastRender = 0;
    const obs = new ResizeObserver(() => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    });
    obs.observe(canvas);

    function getScrollProgress() {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      return docH > 0 ? window.scrollY / docH : 0;
    }

    function render() {
      raf = requestAnimationFrame(render);
      const nowMs = performance.now();
      if (document.hidden || nowMs - lastRender < 1000 / 45) return;
      lastRender = nowMs;
      if (scrollLinked) {
        t = getScrollProgress() * 10;
      } else {
        const now = nowMs / 1000;
        t += now - last; last = now;
      }
      gl!.uniform1f(uTime, t);
      gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    }
    render();

    return () => { cancelAnimationFrame(raf); obs.disconnect(); gl.deleteProgram(prog); };
  }, [scrollLinked]);

  return <canvas ref={canvasRef} className={\`block w-full h-full \${className}\`} />;
}

// Usage:
// <WavrGradient />                        — auto-animating
// <WavrGradient scrollLinked />           — driven by page scroll`;
}

export function exportWebComponent(state: ExportableState): string {
  const colorsArr = exportColorsJson(state.colors);
  const vertex = JSON.stringify(PORTABLE_VERTEX_SHADER);
  const fragment = JSON.stringify(portableFragmentShader(state));

  return `<!-- Wavr Gradient Web Component -->
<script>
class WavrGradient extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: "open" });
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;height:100%";
    shadow.appendChild(canvas);

    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
    if (!gl) { this.textContent = "WebGL 2 not supported"; return; }

    const VS = ${vertex};
    const FS = ${fragment};

    function compile(type, src) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);

    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uRes = gl.getUniformLocation(prog, "u_resolution");
    const colors = ${colorsArr};
    gl.uniform1i(gl.getUniformLocation(prog, "u_colorCount"), colors.length);
    colors.forEach((c, i) => {
      const loc = gl.getUniformLocation(prog, "u_colors[" + i + "]");
      if (loc) gl.uniform3fv(loc, c);
    });

    let t = 0, last = performance.now() / 1000;
    let lastRender = 0;
    const scrollMode = this.getAttribute("mode") === "scroll";
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    new ResizeObserver(resize).observe(canvas); resize();

    const loop = () => {
      requestAnimationFrame(loop);
      const nowMs = performance.now();
      if (document.hidden || nowMs - lastRender < 1000 / 45) return;
      lastRender = nowMs;
      if (scrollMode) {
        const docH = document.documentElement.scrollHeight - window.innerHeight;
        t = docH > 0 ? (window.scrollY / docH) * 10 : 0;
      } else {
        const now = nowMs / 1000; t += now - last; last = now;
      }
      gl.uniform1f(uTime, t);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    loop();
  }
}
customElements.define("wavr-gradient", WavrGradient);
</script>

<!-- Usage: -->
<wavr-gradient style="width: 100%; height: 400px; display: block;"></wavr-gradient>

<!-- Scroll-linked (gradient animates as user scrolls the page): -->
<!-- <wavr-gradient mode="scroll" style="width: 100%; height: 400px; display: block;"></wavr-gradient> -->`;
}

export function exportStandalonePlayer(state: ExportableState): string {
  const colorsArr = exportColorsJson(state.colors);
  const playerSource = `(function(){
const VS=${JSON.stringify(PORTABLE_VERTEX_SHADER)};
const FS=${JSON.stringify(portableFragmentShader(state))};
const COLORS=${colorsArr};
class WavrGradient extends HTMLElement{connectedCallback(){const s=this.attachShadow({mode:"open"});const c=document.createElement("canvas");c.style.cssText="display:block;width:100%;height:100%";s.appendChild(c);const g=c.getContext("webgl2",{alpha:false});if(!g)return;function mk(t,src){const sh=g.createShader(t);g.shaderSource(sh,src);g.compileShader(sh);return sh;}const pr=g.createProgram();g.attachShader(pr,mk(g.VERTEX_SHADER,VS));g.attachShader(pr,mk(g.FRAGMENT_SHADER,FS));g.linkProgram(pr);g.useProgram(pr);const va=g.createVertexArray();g.bindVertexArray(va);const bf=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,bf);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),g.STATIC_DRAW);const po=g.getAttribLocation(pr,"a_position");g.enableVertexAttribArray(po);g.vertexAttribPointer(po,2,g.FLOAT,false,0,0);const uT=g.getUniformLocation(pr,"u_time"),uR=g.getUniformLocation(pr,"u_resolution");g.uniform1i(g.getUniformLocation(pr,"u_colorCount"),COLORS.length);COLORS.forEach((cl,i)=>{const l=g.getUniformLocation(pr,"u_colors["+i+"]");if(l)g.uniform3fv(l,cl);});const scr=this.getAttribute("mode")==="scroll";let t=0,la=performance.now()/1000,lr=0;const ro=new ResizeObserver(()=>{const d=Math.min(devicePixelRatio||1,1.5);c.width=Math.max(1,Math.floor(c.clientWidth*d));c.height=Math.max(1,Math.floor(c.clientHeight*d));g.viewport(0,0,c.width,c.height);});ro.observe(c);(function lp(){requestAnimationFrame(lp);const ms=performance.now();if(document.hidden||ms-lr<1000/45)return;lr=ms;if(scr){const dH=document.documentElement.scrollHeight-window.innerHeight;t=dH>0?(window.scrollY/dH)*10:0;}else{const n=ms/1000;t+=n-la;la=n;}g.uniform1f(uT,t);g.uniform2f(uR,c.width,c.height);g.drawArrays(g.TRIANGLE_STRIP,0,4);})();}}
customElements.define("wavr-gradient",WavrGradient);
})();`;
  return `<!-- Wavr Standalone Player — drop this script anywhere -->
<script src="data:text/javascript;charset=utf-8,${encodeURIComponent(playerSource)}"></script>

<!-- Usage: -->
<wavr-gradient style="width:100%;height:400px;display:block"></wavr-gradient>

<!-- Scroll-linked: -->
<!-- <wavr-gradient mode="scroll" style="width:100%;height:100vh;position:fixed;top:0;left:0;z-index:-1"></wavr-gradient> -->`;
}

export function exportGIF(
  canvas: HTMLCanvasElement,
  duration = 3000,
  fps = 15,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve) => {
    const totalFrames = Math.round((duration / 1000) * fps);
    const delay = Math.round(1000 / fps);
    const width = Math.min(canvas.width, 640);
    const height = Math.round((width / canvas.width) * canvas.height);

    // Create offscreen canvas for resizing
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext("2d")!;

    // Capture frames
    const frames: ImageData[] = [];
    let framesCaptured = 0;

    const captureInterval = setInterval(() => {
      ctx.drawImage(canvas, 0, 0, width, height);
      frames.push(ctx.getImageData(0, 0, width, height));
      framesCaptured++;
      onProgress?.(framesCaptured / totalFrames * 0.5);

      if (framesCaptured >= totalFrames) {
        clearInterval(captureInterval);
        encodeGIF(frames, width, height, delay, onProgress).then(resolve);
      }
    }, delay);
  });
}

// Simple GIF encoder (no external deps, LZW compression)
function encodeGIF(
  frames: ImageData[],
  width: number,
  height: number,
  delay: number,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve) => {
    // Quantize to 256 colors per frame using median cut approximation
    const gif: number[] = [];

    // GIF89a header
    gif.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
    // Logical screen descriptor
    gif.push(width & 0xFF, (width >> 8) & 0xFF);
    gif.push(height & 0xFF, (height >> 8) & 0xFF);
    gif.push(0x70, 0x00, 0x00); // no GCT, 128 colors

    // Netscape extension for looping
    gif.push(0x21, 0xFF, 0x0B);
    const ns = "NETSCAPE2.0";
    for (let i = 0; i < ns.length; i++) gif.push(ns.charCodeAt(i));
    gif.push(0x03, 0x01, 0x00, 0x00, 0x00);

    for (let f = 0; f < frames.length; f++) {
      onProgress?.(0.5 + (f / frames.length) * 0.5);
      const data = frames[f].data;

      // Build color table (simple uniform quantization)
      const palette: number[] = [];
      for (let r = 0; r < 6; r++)
        for (let g = 0; g < 7; g++)
          for (let b = 0; b < 6; b++)
            palette.push(Math.round(r * 51), Math.round(g * 42.5), Math.round(b * 51));
      // Pad to 256
      while (palette.length < 768) palette.push(0);

      // Graphic control extension
      gif.push(0x21, 0xF9, 0x04, 0x00);
      const d = Math.round(delay / 10);
      gif.push(d & 0xFF, (d >> 8) & 0xFF, 0x00, 0x00);

      // Image descriptor with local color table
      gif.push(0x2C);
      gif.push(0, 0, 0, 0); // left, top
      gif.push(width & 0xFF, (width >> 8) & 0xFF);
      gif.push(height & 0xFF, (height >> 8) & 0xFF);
      gif.push(0x87); // local color table, 256 entries

      // Local color table
      for (let i = 0; i < 768; i++) gif.push(palette[i]);

      // Index pixels
      const indices: number[] = [];
      for (let i = 0; i < data.length; i += 4) {
        const ri = Math.round(data[i] / 51);
        const gi = Math.round(data[i + 1] / 42.5);
        const bi = Math.round(data[i + 2] / 51);
        indices.push(Math.min(ri * 42 + gi * 6 + bi, 255));
      }

      // LZW compress
      const minCodeSize = 8;
      gif.push(minCodeSize);
      const lzw = lzwEncode(indices, minCodeSize);
      // Write sub-blocks
      let pos = 0;
      while (pos < lzw.length) {
        const chunk = Math.min(255, lzw.length - pos);
        gif.push(chunk);
        for (let i = 0; i < chunk; i++) gif.push(lzw[pos++]);
      }
      gif.push(0x00); // block terminator
    }

    gif.push(0x3B); // trailer

    const blob = new Blob([new Uint8Array(gif)], { type: "image/gif" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wavr-gradient.gif";
    a.click();
    URL.revokeObjectURL(url);
    onProgress?.(1);
    resolve();
  });
}

function lzwEncode(indices: number[], minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;

  // Build initial dictionary
  const dict = new Map<string, number>();
  for (let i = 0; i < clearCode; i++) dict.set(String(i), i);

  const output: number[] = [];
  let bits = 0;
  let bitCount = 0;

  function writeBits(code: number, size: number) {
    bits |= code << bitCount;
    bitCount += size;
    while (bitCount >= 8) {
      output.push(bits & 0xFF);
      bits >>= 8;
      bitCount -= 8;
    }
  }

  writeBits(clearCode, codeSize);
  let current = String(indices[0]);

  for (let i = 1; i < indices.length; i++) {
    const next = current + "," + indices[i];
    if (dict.has(next)) {
      current = next;
    } else {
      writeBits(dict.get(current)!, codeSize);
      if (nextCode < 4096) {
        dict.set(next, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        writeBits(clearCode, codeSize);
        dict.clear();
        for (let j = 0; j < clearCode; j++) dict.set(String(j), j);
        nextCode = eoiCode + 1;
        codeSize = minCodeSize + 1;
      }
      current = String(indices[i]);
    }
  }
  writeBits(dict.get(current)!, codeSize);
  writeBits(eoiCode, codeSize);
  if (bitCount > 0) output.push(bits & 0xFF);

  return output;
}

export function exportWebM(
  canvas: HTMLCanvasElement,
  duration = 5000,
  filename = "wavr-gradient.webm",
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    };

    recorder.onerror = () => reject(new Error("Recording failed"));

    recorder.start();

    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      onProgress?.(Math.min(elapsed / duration, 1));
    }, 100);

    setTimeout(() => {
      clearInterval(progressInterval);
      recorder.stop();
      onProgress?.(1);
    }, duration);
  });
}
