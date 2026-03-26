export function exportPNG(canvas: HTMLCanvasElement, filename = "wavr-gradient.png") {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

export function exportCSS(colors: [number, number, number][]): string {
  const hexColors = colors.map(([r, g, b]) => {
    const toHex = (n: number) =>
      Math.round(n * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  });

  const stops = hexColors.join(", ");

  return `.wavr-gradient {
  background: linear-gradient(135deg, ${stops});
  background-size: 400% 400%;
  animation: wavr-shift 8s ease infinite;
}

@keyframes wavr-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}`;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function exportWebM(
  canvas: HTMLCanvasElement,
  duration = 5000,
  filename = "wavr-gradient.webm",
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    };

    recorder.onerror = () => reject(new Error("Recording failed"));

    recorder.start();

    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      onProgress?.(Math.min(elapsed / duration, 1));
    }, 100);

    setTimeout(() => {
      clearInterval(progressInterval);
      recorder.stop();
      onProgress?.(1);
    }, duration);
  });
}
