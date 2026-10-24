"use client";

import { Slider } from "@/components/litt/slider";
import { Tooltip } from "@/components/litt/tooltip";

interface TimelineTrackProps {
  position: number;
  duration: number;
  keyframeTimes: number[];
  onSeek: (time: number) => void;
}

/** litt's slider thumb is 20px; Radix keeps it inside the rail, offsetting it by half a thumb at each end. */
const THUMB = 20;

/** Where the thumb's centre sits at `percent`, matching Radix's in-bounds offset, so a mark lines up with it. */
function thumbCentre(percent: number): string {
  const half = THUMB / 2;
  return `calc(${percent}% + ${half - (percent / 50) * half}px)`;
}

const seconds = (t: number) => `${t.toFixed(1)}s`;

/**
 * The timeline's playhead: litt's Slider, so it has the keys, the label and the
 * reading, with the keyframes as marks under the rail. The registry has no
 * animation timeline (its Time scrubber springs a controlled value, which lags
 * behind playback), so the marks are drawn here.
 */
export default function TimelineTrack({ position, duration, keyframeTimes, onSeek }: TimelineTrackProps) {
  return (
    <div className="flex flex-col gap-1">
      <Slider
        label="Playhead"
        value={Math.min(position, duration)}
        min={0}
        max={duration}
        step={0.1}
        onValueChange={onSeek}
        showValue
        formatValue={(t) => `${seconds(t)} of ${duration}s`}
      />
      <div className="relative h-4" aria-label="Keyframes" role="group">
        {keyframeTimes.map((time, i) => (
          <Tooltip key={i} content={`Keyframe at ${seconds(time)}`}>
            <button
              type="button"
              aria-label={`Go to keyframe at ${seconds(time)}`}
              onClick={() => onSeek(time)}
              className="group absolute top-0 flex h-4 w-4 -translate-x-1/2 cursor-pointer items-start justify-center rounded-litt-control focus-visible:outline-2 focus-visible:outline-litt-focus"
              style={{ left: thumbCentre((time / duration) * 100) }}
            >
              <span className="h-3 w-0.5 rounded-litt-control bg-litt-fg-muted transition-colors duration-(--litt-dur-instant) ease-litt group-hover:bg-litt-fg" />
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
