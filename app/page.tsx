"use client";

import { useState, useRef } from "react";
import Canvas from "@/components/Canvas";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ExportModal from "@/components/ExportModal";

export default function Home() {
  const [exportOpen, setExportOpen] = useState(false);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  return (
    <div className="h-screen w-screen bg-root flex flex-col">
      <TopBar onExport={() => setExportOpen(true)} />
      <div className="flex flex-1 min-h-0">
        <Canvas onCanvasReady={(el) => { canvasElRef.current = el; }} />
        <Sidebar />
      </div>
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        canvasRef={canvasElRef.current}
      />
    </div>
  );
}
