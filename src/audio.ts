class AudioEngine {
  private ctx: AudioContext | null = null;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, vol = 0.1) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playSuccess(index: number) {
    this.init();
    // Pitch goes up slightly based on sequence index
    const baseFreq = 440; // A4
    this.playTone(baseFreq + (index * 40), 'sine', 0.15, 0.2);
  }

  playError() {
    this.init();
    this.playTone(150, 'sawtooth', 0.3, 0.3);
  }

  playComplete() {
    this.init();
    setTimeout(() => this.playTone(440, 'square', 0.1, 0.1), 0);
    setTimeout(() => this.playTone(554.37, 'square', 0.1, 0.1), 100); // C#5
    setTimeout(() => this.playTone(659.25, 'square', 0.1, 0.1), 200); // E5
    setTimeout(() => this.playTone(880, 'square', 0.4, 0.1), 300);    // A5
  }
}

export const audio = new AudioEngine();
