"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useGradientStore } from "@/lib/store";
import { GradientEngine } from "@wavr/core";
import { Textarea } from "@/components/litt/input";
import { Button } from "@/components/litt/button";
import { Tag } from "@/components/litt/tag";
import PanelSection from "@/components/ui/PanelSection";

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
    <div className="flex flex-col px-4 pb-6">
      <PanelSection title="Shader lab">
        <div className="flex items-center justify-between gap-2">
          <Tag status={status.ok ? (status.message === "Ready" ? "neutral" : "success") : "danger"}>
            {status.ok ? (status.message === "Ready" ? "Ready" : "Compiled") : "Error"}
          </Tag>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Reset
          </Button>
        </div>
        <Textarea
          label="Gradient body"
          help={<code className="font-litt-mono">vec3 custom(vec2 uv, float time) &#123; … &#125;</code>}
          error={status.ok ? undefined : <span className="font-litt-mono break-all">{status.message}</span>}
          value={code}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
          mono
          size="sm"
          rows={12}
        />
      </PanelSection>

      <PanelSection title="Reference">
        <div className="flex flex-col gap-1">
          <h4 className="text-litt-small font-litt-title text-litt-fg">Uniforms</h4>
          <p className="font-litt-mono text-litt-caption font-normal text-litt-fg-muted">
            u_time, u_resolution, u_mouse, u_colors[8], u_colorCount, u_speed, u_complexity, u_scale, u_distortion
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <h4 className="text-litt-small font-litt-title text-litt-fg">Functions</h4>
          <p className="font-litt-mono text-litt-caption font-normal text-litt-fg-muted">
            snoise(vec2), fbm(vec2, int), getGradientColor(float), hash(vec2), curlNoise(vec2, float)
          </p>
        </div>
      </PanelSection>
    </div>
  );
}
