"use client";

import { useGradientStore } from "@/lib/store";
import { PlaybackMode } from "@/lib/timeline";

const MODE_LABELS: Record<PlaybackMode, string> = {
  loop: "Loop",
  bounce: "Bounce",
  once: "Once",
};

export default function Timeline() {
  const store = useGradientStore();

  if (!store.timelineEnabled) {
    return (
      <div className="h-8 border-t border-border bg-base flex items-center justify-center">
        <button
          onClick={store.toggleTimeline}
          className="text-[10px] text-text-tertiary hover:text-text-secondary transition-colors"
        >
          Enable Timeline
        </button>
      </div>
    );
  }

  const keyframes = store.keyframes as import("@/lib/timeline").Keyframe[];
  const timelinePosition = store.timelinePosition as number;
  const timelineDuration = store.timelineDuration as number;
  const timelinePlaybackMode = store.timelinePlaybackMode as PlaybackMode;
  const progress = (timelinePosition / timelineDuration) * 100;

  return (
    <div className="border-t border-border bg-base shrink-0">
      {/* Controls row */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
        <button
          onClick={store.toggleTimeline}
          className="text-[10px] text-text-tertiary hover:text-text-primary transition-colors"
          aria-label="Disable timeline"
        >
          x
        </button>
        <button
          onClick={store.addKeyframe}
          className="text-[10px] text-accent hover:text-accent/80 transition-colors"
        >
          + Key
        </button>
        <span className="font-mono text-[10px] text-text-tertiary tabular-nums">
          {timelinePosition.toFixed(1)}s / {timelineDuration}s
        </span>
        <div className="flex-1" />
        <button
          onClick={() => {
            const modes: PlaybackMode[] = ["loop", "bounce", "once"];
            const idx = modes.indexOf(timelinePlaybackMode);
            store.setTimelinePlaybackMode(modes[(idx + 1) % modes.length]);
          }}
          className="text-[10px] text-text-tertiary hover:text-text-secondary transition-colors"
        >
          {MODE_LABELS[timelinePlaybackMode]}
        </button>
        <select
          value={timelineDuration}
          onChange={(e) => store.setTimelineDuration(Number(e.target.value))}
          className="bg-surface border border-border rounded px-1 py-0.5 text-[10px] text-text-secondary
            appearance-none cursor-pointer focus:outline-none"
        >
          <option value={5}>5s</option>
          <option value={10}>10s</option>
          <option value={20}>20s</option>
          <option value={30}>30s</option>
        </select>
      </div>

      {/* Timeline track */}
      <div className="relative h-8 px-3 py-1">
        {/* Track background */}
        <div
          className="relative h-full bg-surface rounded cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            store.setTimelinePosition(x * timelineDuration);
          }}
        >
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-accent z-10"
            style={{ left: `${progress}%` }}
          />

          {/* Keyframe markers */}
          {keyframes.map((kf, i) => {
            const kfPos = (kf.time / timelineDuration) * 100;
            return (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-accent rounded-sm -ml-[5px] cursor-pointer
                  hover:scale-125 transition-transform z-20"
                style={{ left: `${kfPos}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  store.setTimelinePosition(kf.time);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  store.removeKeyframe(i);
                }}
                title={`${kf.time.toFixed(1)}s (double-click to remove)`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
