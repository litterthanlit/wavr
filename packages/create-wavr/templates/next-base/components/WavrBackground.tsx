"use client";

import { useCallback, useState } from "react";
import { WavrGradient } from "@wavr/gradient/editor";
import type { GradientConfig } from "@wavr/gradient";
import { wavrConfig as initialConfig } from "../wavr.config";

export function WavrBackground() {
  const [config, setConfig] = useState(initialConfig);
  const isDev = process.env.NODE_ENV !== "production";

  const onApply = useCallback(async (next: GradientConfig) => {
    const response = await fetch("/api/wavr-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: next }),
    });
    if (!response.ok) {
      throw new Error("Could not write wavr.config.ts");
    }
  }, []);

  return (
    <WavrGradient
      config={config}
      editor={isDev}
      onConfigChange={setConfig}
      onApply={isDev ? onApply : undefined}
      className="wavr-bg"
    />
  );
}
