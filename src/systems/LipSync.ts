export class LipSyncAnalyzer {
  private analyser: AnalyserNode | null = null;
  // Explicitly backed by ArrayBuffer (not SharedArrayBuffer): the Web Audio
  // getByte*Data methods only accept that narrower form.
  private timeArray: Uint8Array<ArrayBuffer> | null = null;
  private freqArray: Uint8Array<ArrayBuffer> | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private connectedElements = new WeakSet<HTMLAudioElement>();

  private smoothedLevel = 0;
  private smoothedBands = { low: 0, mid: 0, high: 0 };

  getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  connectAudioElement(audio: HTMLAudioElement) {
    if (this.connectedElements.has(audio)) return;

    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    // Low frequency-domain smoothing; the mouth envelope is smoothed lightly in
    // update() instead, so the jaw tracks speech tightly without lag.
    this.analyser.smoothingTimeConstant = 0.2;

    this.source = ctx.createMediaElementSource(audio);
    this.source.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this.timeArray = new Uint8Array(this.analyser.fftSize);
    this.freqArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.connectedElements.add(audio);
  }

  update(): { level: number; low: number; mid: number; high: number } {
    if (!this.analyser || !this.timeArray || !this.freqArray) {
      return { level: 0, low: 0, mid: 0, high: 0 };
    }

    // ── Loudness envelope from time-domain RMS — the real driver of mouth
    //    openness. Tracks speech instantly (no frequency-averaging washout). ──
    this.analyser.getByteTimeDomainData(this.timeArray);
    let sumSq = 0;
    for (let i = 0; i < this.timeArray.length; i++) {
      const v = (this.timeArray[i] - 128) / 128; // -1..1
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / this.timeArray.length);
    // Speech RMS sits ~0.03–0.35; scale into a usable 0..1 mouth-open range.
    const level = Math.min(1, rms * 3.8);

    // Frequency bands (kept for callers that want vowel shaping).
    this.analyser.getByteFrequencyData(this.freqArray);
    const n = this.freqArray.length;
    const lowEnd = Math.floor(n * 0.15);
    const midEnd = Math.floor(n * 0.5);
    let lowSum = 0, midSum = 0, highSum = 0;
    for (let i = 0; i < n; i++) {
      const val = this.freqArray[i] / 255;
      if (i < lowEnd) lowSum += val;
      else if (i < midEnd) midSum += val;
      else highSum += val;
    }
    const low = lowSum / lowEnd;
    const mid = midSum / (midEnd - lowEnd);
    const high = highSum / (n - midEnd);

    // Light asymmetric smoothing: open fast, close a touch slower — natural.
    const s = level > this.smoothedLevel ? 0.6 : 0.35;
    this.smoothedLevel += (level - this.smoothedLevel) * s;
    this.smoothedBands.low += (low - this.smoothedBands.low) * 0.4;
    this.smoothedBands.mid += (mid - this.smoothedBands.mid) * 0.4;
    this.smoothedBands.high += (high - this.smoothedBands.high) * 0.4;

    return {
      level: this.smoothedLevel,
      low: this.smoothedBands.low,
      mid: this.smoothedBands.mid,
      high: this.smoothedBands.high,
    };
  }

  dispose() {
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.audioContext?.close();
    this.source = null;
    this.analyser = null;
    this.audioContext = null;
    this.timeArray = null;
    this.freqArray = null;
  }
}
