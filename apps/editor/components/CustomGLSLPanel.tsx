"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useGradientStore } from "@/lib/store";
import { GradientEngine } from "@wavr/core";

const DEFAULT_TEMPLATE = `  vec2 p = uv * u_scale;
  float n = fbm(p + vec2(time * 0.3, time * 0.2), int(u_complexity));
  return getGradientColor(n * 0.5 + 0.5);`;

interface CustomGLSLPanelProps {
  engineRef: React.RefObject<GradientEngine | null>;
}

export default function CustomGLSLPanel({ engineRef }: CustomGLSLPanelProps) {
  const store = useGradientStore();
  const [code, setCode] = useState(store.customGLSL ?? DEFAULT_TEMPLATE);
  const [status, setStatus] = useState<{ ok: boolean; message: string }>({ ok: true, message: "Ready" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync store → local state when store changes externally (e.g., project load)
  useEffect(() => {
    const unsub = useGradientStore.subscribe((state) => {
      if (state.customGLSL === null && code !== DEFAULT_TEMPLATE) {
        setCode(DEFAULT_TEMPLATE);
        setStatus({ ok: true, message: "Ready" });
      }
    });
    return unsub;
  }, [code]);

  const compile = useCallback((newCode: string) => {
    const engine = engineRef.current;
    if (!engine) return;

    if (!newCode.trim()) {
      const result = engine.setCustomShader(null);
      if (result.success) {
        useGradientStore.getState().set({ customGLSL: null } as Partial<ReturnType<typeof useGradientStore.getState>>);
        setStatus({ ok: true, message: "Ready" });
      }
      return;
    }

    const result = engine.setCustomShader(newCode);
    if (result.success) {
      useGradientStore.getState().set({ customGLSL: newCode } as Partial<ReturnType<typeof useGradientStore.getState>>);
      setStatus({ ok: true, message: "Compiled OK" });
    } else {
      setStatus({ ok: false, message: result.error ?? "Unknown error" });
    }
  }, [engineRef]);

  const handleChange = (newCode: string) => {
    setCode(newCode);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => compile(newCode), 500);
  };

  const handleReset = () => {
    setCode(DEFAULT_TEMPLATE);
    const engine = engineRef.current;
    if (engine) {
      engine.setCustomShader(null);
      useGradientStore.getState().set({ customGLSL: null } as Partial<ReturnType<typeof useGradientStore.getState>>);
    }
    setStatus({ ok: true, message: "Ready" });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
          Custom GLSL
        </span>
        <button
          onClick={handleReset}
          className="text-[10px] text-text-tertiary hover:text-accent transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[10px] text-text-tertiary font-mono">
          vec3 custom(vec2 uv, float time) &#123;
        </span>
        <textarea
          value={code}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
          className="w-full h-48 px-3 py-2 text-[11px] font-mono leading-relaxed
            bg-surface border border-border rounded-md text-text-primary
            focus:outline-none focus:border-accent transition-colors resize-y"
        />
        <span className="text-[10px] text-text-tertiary font-mono">&#125;</span>
      </div>

      {/* Compile status */}
      <div className={`flex items-center gap-2 text-[10px] ${status.ok ? "text-green-500" : "text-red-400"}`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.ok ? "bg-green-500" : "bg-red-400"}`} />
        <span className="font-mono break-all">{status.message}</span>
      </div>

      {/* Reference */}
      <div className="flex flex-col gap-2 text-[10px] text-text-tertiary">
        <span className="font-medium">Available uniforms:</span>
        <span className="font-mono leading-relaxed">
          u_time, u_resolution, u_mouse, u_colors[8], u_colorCount, u_speed, u_complexity, u_scale, u_distortion
        </span>
        <span className="font-medium mt-1">Available functions:</span>
        <span className="font-mono leading-relaxed">
          snoise(vec2), fbm(vec2, int), getGradientColor(float), hash(vec2), curlNoise(vec2, float)
        </span>
      </div>
    </div>
  );
}
