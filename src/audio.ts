/** Small, self-contained soundscape. No audio is created until start() is called. */
export class AudioEngine {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private timer: number | null = null;
  private started = false;
  private disposed = false;
  private muted = false;
  private nextNoteAt = 0;
  private noteIndex = 0;
  private lastClickAt = -Infinity;
  private lastPaperAt = -Infinity;
  private noise: AudioBuffer | null = null;

  // A gentle F-major pentatonic melody, with rests between short phrases.
  private readonly melody = [69, 72, 77, 74, 72, 69, 65, 67, 69, 72, 67, 65];

  /** Call directly from the first pointer/keyboard gesture, never on page load. */
  async start(): Promise<void> {
    if (this.disposed) return;
    try {
      if (!this.context) {
        const BrowserAudioContext = window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!BrowserAudioContext) return;
        this.context = new BrowserAudioContext();
        this.output = this.context.createGain();
        this.output.gain.value = this.muted ? 0 : 0.62;
        const softener = this.context.createBiquadFilter();
        softener.type = 'lowpass';
        softener.frequency.value = 4200;
        this.output.connect(softener);
        softener.connect(this.context.destination);
        document.addEventListener('visibilitychange', this.onVisibilityChange);
      }
      this.started = true;
      if (document.hidden) return;
      // resume() is invoked synchronously before this method's first await.
      await this.context.resume();
      if (this.disposed || document.hidden) return;
      this.scheduleMusic();
    } catch {
      // Reading remains available if audio is disabled by the browser or device.
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.context || !this.output || this.disposed) return;
    try {
      const now = this.context.currentTime;
      this.output.gain.cancelScheduledValues(now);
      this.output.gain.setTargetAtTime(muted ? 0 : 0.62, now, 0.035);
    } catch { /* A closed audio device must not interrupt the story. */ }
  }

  click(): void {
    const context = this.readyContext();
    if (!context || context.currentTime - this.lastClickAt < 0.09) return;
    this.lastClickAt = context.currentTime;
    try {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(720, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.075);
      envelope.gain.setValueAtTime(0.0001, context.currentTime);
      envelope.gain.exponentialRampToValueAtTime(0.047, context.currentTime + 0.006);
      envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.085);
      oscillator.connect(envelope);
      envelope.connect(this.output!);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.095);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    } catch { /* Sound effects are optional. */ }
  }

  paper(): void {
    const context = this.readyContext();
    if (!context || context.currentTime - this.lastPaperAt < 0.35) return;
    this.lastPaperAt = context.currentTime;
    try {
      if (!this.noise) {
        this.noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.52), context.sampleRate);
        const samples = this.noise.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < samples.length; i++) {
          previous = (previous + (Math.random() * 2 - 1) * 0.045) / 1.045;
          samples[i] = previous * 3.5;
        }
      }
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const envelope = context.createGain();
      source.buffer = this.noise;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, context.currentTime);
      filter.frequency.linearRampToValueAtTime(1800, context.currentTime + 0.2);
      filter.Q.value = 0.55;
      const now = context.currentTime;
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.linearRampToValueAtTime(0.20, now + 0.07);
      envelope.gain.linearRampToValueAtTime(0.055, now + 0.17);
      envelope.gain.linearRampToValueAtTime(0.14, now + 0.27);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(this.output!);
      source.start();
      source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
    } catch { /* Sound effects are optional. */ }
  }

  sparkle(): void {
    const context = this.readyContext();
    if (!context) return;
    try {
      [77, 81, 84, 89].forEach((note, index) => {
        this.bell(note, context.currentTime + index * 0.115, 0.05, 1.0);
      });
    } catch { /* Sound effects are optional. */ }
  }

  storyBell(echo = false): void {
    const context = this.readyContext();
    if (!context) return;
    try {
      const now = context.currentTime;
      [0, .22].forEach(offset => {
        this.bell(84, now + offset, .065, .35);
        if (echo) this.bell(84, now + .76 + offset, .028, .35);
      });
    } catch { /* The visible echo and story text also carry this clue. */ }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopTimer();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.output = null;
    this.noise = null;
  }

  private readyContext(): AudioContext | null {
    return this.started && !this.disposed && !document.hidden && this.context?.state === 'running'
      ? this.context
      : null;
  }

  private onVisibilityChange = (): void => {
    if (!this.context || !this.started || this.disposed) return;
    this.stopTimer();
    if (document.hidden) {
      void this.context.suspend().catch(() => {});
      return;
    }
    void this.context.resume().then(() => {
      if (!this.disposed && !document.hidden) this.scheduleMusic();
    }).catch(() => {});
  };

  private stopTimer(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private scheduleMusic(): void {
    if (this.timer !== null || !this.readyContext()) return;
    this.nextNoteAt = this.context!.currentTime + 0.45;
    const tick = () => {
      const context = this.readyContext();
      if (!context) return;
      try {
        if (this.nextNoteAt < context.currentTime) this.nextNoteAt = context.currentTime + 0.1;
        if (this.nextNoteAt > context.currentTime + 0.6) return;
        this.bell(this.melody[this.noteIndex % this.melody.length], this.nextNoteAt, 0.033, 2.7);
        if (this.noteIndex % 4 === 0) this.pad(this.nextNoteAt, this.noteIndex % 8 === 0 ? 53 : 60);
        this.noteIndex += 1;
        this.nextNoteAt += this.noteIndex % 4 === 0 ? 3.4 : 1.9;
      } catch { /* Leave the scheduler alive for a recovered audio device. */ }
    };
    tick();
    this.timer = window.setInterval(tick, 250);
  }

  private bell(midi: number, when: number, volume: number, duration: number): void {
    const context = this.context;
    if (!context || !this.output || this.disposed) return;
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.exponentialRampToValueAtTime(volume, when + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    envelope.connect(this.output);
    const fundamental = context.createOscillator();
    const overtone = context.createOscillator();
    const overtoneGain = context.createGain();
    fundamental.type = overtone.type = 'sine';
    fundamental.frequency.value = frequency;
    overtone.frequency.value = frequency * 2.002;
    overtoneGain.gain.value = 0.16;
    fundamental.connect(envelope);
    overtone.connect(overtoneGain);
    overtoneGain.connect(envelope);
    fundamental.start(when);
    overtone.start(when);
    fundamental.stop(when + duration + 0.04);
    overtone.stop(when + duration + 0.04);
    fundamental.onended = () => { fundamental.disconnect(); envelope.disconnect(); };
    overtone.onended = () => { overtone.disconnect(); overtoneGain.disconnect(); };
  }

  private pad(when: number, midi: number): void {
    const context = this.context;
    if (!context || !this.output || this.disposed) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.exponentialRampToValueAtTime(0.029, when + 1.5);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + 7.8);
    oscillator.connect(envelope);
    envelope.connect(this.output);
    oscillator.start(when);
    oscillator.stop(when + 8);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
}

export default AudioEngine;
