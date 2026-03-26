import Canvas from "@/components/Canvas";

export default function Home() {
  return (
    <div className="h-screen w-screen bg-root flex flex-col">
      {/* TopBar placeholder */}
      <div className="h-[52px] shrink-0 border-b border-border bg-base/70 backdrop-blur-[20px] flex items-center px-4">
        <span className="font-mono text-sm font-bold text-text-primary tracking-wider">WAVR</span>
      </div>
      <div className="flex flex-1 min-h-0">
        <Canvas />
        {/* Sidebar placeholder */}
        <div className="w-[320px] shrink-0 bg-base border-l border-border" />
      </div>
    </div>
  );
}
