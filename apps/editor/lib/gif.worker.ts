// Encodes GIFs off the main thread. See encodeGifAsync() in export.ts.
import { encodeGif } from "./gif";

export interface GifWorkerRequest {
  width: number;
  height: number;
  frames: Uint8ClampedArray[];
  delayCs: number;
}

export type GifWorkerResponse =
  | { type: "progress"; value: number }
  | { type: "done"; bytes: Uint8Array }
  | { type: "error"; message: string };

interface WorkerScope {
  onmessage: ((event: MessageEvent<GifWorkerRequest>) => void) | null;
  postMessage(message: GifWorkerResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  try {
    const bytes = encodeGif({
      ...event.data,
      onProgress: (value) => scope.postMessage({ type: "progress", value }),
    });
    scope.postMessage({ type: "done", bytes }, [bytes.buffer]);
  } catch (err) {
    scope.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
