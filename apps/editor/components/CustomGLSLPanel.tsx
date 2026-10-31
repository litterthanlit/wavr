"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useGradientStore } from "@/lib/store";
import { GradientEngine } from "@wavr/core";
import { Button } from "@/components/litt/button";
import { Textarea } from "@/components/litt/input";

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
        <h3 className="text-litt-caption font-litt-label text-litt-fg-muted">Shader lab</h3>
        <Button size="sm" variant="ghost" onClick={handleReset}>
          Reset
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Textarea
          label={<span className="font-litt-mono font-normal">vec3 custom(vec2 uv, float time) &#123;</span>}
          size="sm"
          mono
          rows={10}
          value={code}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
        />
        <span className="text-litt-caption font-normal text-litt-fg-subtle font-mono">&#125;</span>
      </div>

      {/* Compile status */}
      {/* litt: the word says the status, and only its text takes the status colour. */}
      <div role="status" className={`text-litt-caption font-normal font-mono break-all ${status.ok ? "text-litt-success" : "text-litt-danger"}`}>
        {status.message}
      </div>

      {/* Reference */}
      <div className="flex flex-col gap-2 text-litt-caption font-normal text-litt-fg-subtle">
        <span className="font-litt-title">Available uniforms:</span>
        <span className="font-mono leading-relaxed">
          u_time, u_resolution, u_mouse, u_colors[8], u_colorCount, u_speed, u_complexity, u_scale, u_distortion
        </span>
        <span className="font-litt-title mt-1">Available functions:</span>
        <span className="font-mono leading-relaxed">
          snoise(vec2), fbm(vec2, int), getGradientColor(float), hash(vec2), curlNoise(vec2, float)
        </span>
      </div>
    </div>
  );
}
