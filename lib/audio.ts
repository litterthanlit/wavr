export interface AudioBands {
  bass: number;      // 20-250 Hz
  lowMid: number;    // 250-500 Hz
  mid: number;       // 500-2000 Hz
  highMid: number;   // 2000-4000 Hz
  treble: number;    // 4000-20000 Hz
  energy: number;    // overall energy 0-1
  beat: boolean;     // beat detected this frame
}

const EMPTY_BANDS: AudioBands = {
  bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, energy: 0, beat: false,
};

export class AudioAnalyzer {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private prevEnergy = 0;
  private beatThreshold = 1.4;
  private beatCooldown = 0;

  get active(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  async connectMicrophone(): Promise<void> {
    await this.disconnect();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.ctx = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    this.source = this.ctx.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
  }

  async connectFile(file: File): Promise<HTMLAudioElement> {
    await this.disconnect();
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audio.crossOrigin = "anonymous";
    this.ctx = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    this.source = this.ctx.createMediaElementSource(audio);
    this.source.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    return audio;
  }

  async disconnect(): Promise<void> {
    if (this.source) {
      this.source.disconnect();
      if (this.source instanceof MediaStreamAudioSourceNode) {
        const stream = this.source.mediaStream;
        stream.getTracks().forEach(t => t.stop());
      }
    }
    if (this.ctx) {
      await this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = new Uint8Array(0);
    this.prevEnergy = 0;
  }

  getBands(): AudioBands {
    if (!this.analyser) return EMPTY_BANDS;
    this.analyser.getByteFrequencyData(this.dataArray);

    const binCount = this.dataArray.length;
    const sampleRate = this.ctx!.sampleRate;
    const binWidth = sampleRate / (binCount * 2);

    // Frequency band boundaries in bin indices
    const bassEnd = Math.min(Math.floor(250 / binWidth), binCount);
    const lowMidEnd = Math.min(Math.floor(500 / binWidth), binCount);
    const midEnd = Math.min(Math.floor(2000 / binWidth), binCount);
    const highMidEnd = Math.min(Math.floor(4000 / binWidth), binCount);

    const avg = (start: number, end: number) => {
      if (end <= start) return 0;
      let sum = 0;
      for (let i = start; i < end; i++) sum += this.dataArray[i];
      return sum / ((end - start) * 255);
    };

    const bass = avg(0, bassEnd);
    const lowMid = avg(bassEnd, lowMidEnd);
    const mid = avg(lowMidEnd, midEnd);
    const highMid = avg(midEnd, highMidEnd);
    const treble = avg(highMidEnd, binCount);
    const energy = bass * 0.4 + lowMid * 0.2 + mid * 0.2 + highMid * 0.1 + treble * 0.1;

    // Simple beat detection: energy spike relative to recent average
    let beat = false;
    this.beatCooldown = Math.max(0, this.beatCooldown - 1);
    if (this.beatCooldown === 0 && energy > this.prevEnergy * this.beatThreshold && energy > 0.15) {
      beat = true;
      this.beatCooldown = 8; // ~8 frames cooldown at 60fps
    }
    this.prevEnergy = this.prevEnergy * 0.9 + energy * 0.1;

    return { bass, lowMid, mid, highMid, treble, energy, beat };
  }
}
