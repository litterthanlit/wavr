"use client";

import { useGradientStore } from "@/lib/store";
import type { Keyframe, PlaybackMode } from "@/lib/timeline";
import TimelineTrack from "@/components/TimelineTrack";
import { Button } from "@/components/litt/button";
import { Segmented } from "@/components/litt/segmented";
import { Select } from "@/components/litt/select";
import { Tooltip } from "@/components/litt/tooltip";
import { MinusIcon, PlusIcon, XIcon } from "@/components/litt/icons";

const MODE_OPTIONS: { value: PlaybackMode; label: string }[] = [
  { value: "loop", label: "Loop" },
  { value: "bounce", label: "Bounce" },
  { value: "once", label: "Once" },
];

const DURATION_OPTIONS = [5, 10, 20, 30].map((s) => ({ value: String(s), label: `${s}s` }));

/** Same tolerance the store uses to treat a keyframe as the one under the playhead. */
const KEYFRAME_TOLERANCE = 0.05;

export default function Timeline() {
  const store = useGradientStore();

  if (!store.timelineEnabled) {
    return (
      <div className="flex h-10 shrink-0 items-center border-t border-litt-line bg-litt-surface-1 px-2">
        <Button variant="ghost" size="sm" icon={<PlusIcon />} onClick={store.toggleTimeline}>
          Add motion timeline
        </Button>
      </div>
    );
  }

  const keyframes = store.keyframes as Keyframe[];
  const timelinePosition = store.timelinePosition as number;
  const timelineDuration = store.timelineDuration as number;
  const timelinePlaybackMode = store.timelinePlaybackMode as PlaybackMode;
  const current = keyframes.findIndex((kf) => Math.abs(kf.time - timelinePosition) < KEYFRAME_TOLERANCE);

  return (
    <section aria-label="Timeline" className="flex shrink-0 flex-col gap-3 border-t border-litt-line bg-litt-surface-1 px-4 pt-3 pb-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 font-litt-title text-litt-small text-litt-fg">Timeline</span>
        <Segmented
          legend="Playback"
          size="sm"
          value={timelinePlaybackMode}
          onValueChange={store.setTimelinePlaybackMode}
          options={MODE_OPTIONS}
        />
        <div className="w-20">
          <Select
            aria-label="Duration"
            size="sm"
            value={String(timelineDuration)}
            onValueChange={(value) => store.setTimelineDuration(Number(value))}
            options={DURATION_OPTIONS}
          />
        </div>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" icon={<PlusIcon />} onClick={store.addKeyframe}>
          Keyframe
        </Button>
        {/* Enabled while the playhead sits on a keyframe; replaces double-click to delete. */}
        <Button
          variant="ghost"
          size="sm"
          icon={<MinusIcon />}
          onClick={() => store.removeKeyframe(current)}
          disabled={current < 0}
        >
          Remove
        </Button>
        <Tooltip content="Turn the timeline off">
          <Button variant="ghost" size="sm" iconOnly aria-label="Turn the timeline off" icon={<XIcon />} onClick={store.toggleTimeline} />
        </Tooltip>
      </div>
      <TimelineTrack
        position={timelinePosition}
        duration={timelineDuration}
        keyframeTimes={keyframes.map((kf) => kf.time)}
        onSeek={store.setTimelinePosition}
      />
    </section>
  );
}
