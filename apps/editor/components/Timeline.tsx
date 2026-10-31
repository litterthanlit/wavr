"use client";

import { useGradientStore } from "@/lib/store";
import { PlaybackMode } from "@/lib/timeline";
import { Button } from "@/components/litt/button";
import { PlusIcon, XIcon } from "@/components/litt/icons";
import Segmented from "@/components/ui/Segmented";
import { LazySelect } from "@/components/lazy";

const MODE_OPTIONS: { value: PlaybackMode; label: string }[] = [
  { value: "loop", label: "Loop" },
  { value: "bounce", label: "Bounce" },
  { value: "once", label: "Once" },
];

const DURATION_OPTIONS = [5, 10, 20, 30].map((s) => ({ value: String(s), label: `${s}s` }));

export default function Timeline() {
  const store = useGradientStore();

  if (!store.timelineEnabled) {
    return (
      <div className="flex h-10 items-center justify-center border-t border-litt-line bg-litt-surface-1">
        <Button size="sm" variant="ghost" icon={<PlusIcon />} onClick={store.toggleTimeline}>
          Add motion timeline
        </Button>
      </div>
    );
  }

  const keyframes = store.keyframes as import("@/lib/timeline").Keyframe[];
  const timelinePosition = store.timelinePosition as number;
  const timelineDuration = store.timelineDuration as number;
  const timelinePlaybackMode = store.timelinePlaybackMode as PlaybackMode;
  const progress = (timelinePosition / timelineDuration) * 100;

  return (
    <div className="border-t border-litt-line bg-litt-surface-1 shrink-0">
      {/* Controls row */}
      <div className="flex items-center gap-2 border-b border-litt-line px-3 py-1">
        <span className="mr-1 text-litt-caption font-litt-label text-litt-fg-muted">Timeline</span>
        <Button iconOnly size="sm" variant="ghost" onClick={store.toggleTimeline} aria-label="Remove timeline">
          <XIcon />
        </Button>
        <Button size="sm" variant="ghost" icon={<PlusIcon />} onClick={store.addKeyframe}>
          Keyframe
        </Button>
        <span className="text-litt-caption font-normal text-litt-fg-subtle tabular-nums">
          {timelinePosition.toFixed(1)}s / {timelineDuration}s
        </span>
        <div className="flex-1" />
        <div className="w-56">
          <Segmented label="Playback" value={timelinePlaybackMode} options={MODE_OPTIONS} onChange={store.setTimelinePlaybackMode} />
        </div>
        <div className="w-20">
          <LazySelect
            aria-label="Duration"
            size="sm"
            value={String(timelineDuration)}
            options={DURATION_OPTIONS}
            onValueChange={(v: string) => store.setTimelineDuration(Number(v))}
          />
        </div>
      </div>

      {/* Timeline track */}
      <div className="relative h-8 px-3 py-1">
        {/* Track background */}
        <div
          className="relative h-full bg-litt-surface-2 rounded-litt-control cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            store.setTimelinePosition(x * timelineDuration);
          }}
        >
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-litt-fg z-10"
            style={{ left: `${progress}%` }}
          />

          {/* Keyframe markers */}
          {keyframes.map((kf, i) => {
            const kfPos = (kf.time / timelineDuration) * 100;
            return (
              <div
                key={i}
                className="absolute top-1/2 z-20 size-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-litt-control bg-litt-fg"
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
