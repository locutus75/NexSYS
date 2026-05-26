export class LightningSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // Thunder nodes
  private rumbleOsc: OscillatorNode | null = null;
  private rumbleGain: GainNode | null = null;
  private rumbleFilter: BiquadFilterNode | null = null;
  
  // Crackle nodes
  private noiseSource: AudioBufferSourceNode | null = null;
  private crackleGain: GainNode | null = null;
  private crackleFilter: BiquadFilterNode | null = null;

  private isPlaying = false;
  private targetIntensity = 0;
  private updateInterval: number | null = null;

  public init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0; // Start silent
    this.masterGain.connect(this.ctx.destination);

    // --- Setup Thunder (Rumble) ---
    this.rumbleOsc = this.ctx.createOscillator();
    this.rumbleOsc.type = 'sawtooth';
    this.rumbleOsc.frequency.value = 40; // Low frequency

    this.rumbleFilter = this.ctx.createBiquadFilter();
    this.rumbleFilter.type = 'lowpass';
    this.rumbleFilter.frequency.value = 100; // Filter out high frequencies

    this.rumbleGain = this.ctx.createGain();
    this.rumbleGain.gain.value = 0;

    this.rumbleOsc.connect(this.rumbleFilter);
    this.rumbleFilter.connect(this.rumbleGain);
    this.rumbleGain.connect(this.masterGain);

    this.rumbleOsc.start();

    // --- Setup Crackle (Noise) ---
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Crackle is sparse white noise: mostly 0, occasionally a loud spike
      if (Math.random() < 0.05) {
        output[i] = (Math.random() * 2 - 1) * 0.5;
      } else {
        output[i] = 0;
      }
    }

    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = noiseBuffer;
    this.noiseSource.loop = true;

    this.crackleFilter = this.ctx.createBiquadFilter();
    this.crackleFilter.type = 'highpass';
    this.crackleFilter.frequency.value = 1000; // Only crisp highs

    this.crackleGain = this.ctx.createGain();
    this.crackleGain.gain.value = 0;

    this.noiseSource.connect(this.crackleFilter);
    this.crackleFilter.connect(this.crackleGain);
    this.crackleGain.connect(this.masterGain);

    this.noiseSource.start();
  }

  public start(volume: number) {
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    
    this.isPlaying = true;
    if (this.masterGain && this.ctx) {
      // Fade in master volume
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.1);
    }

    // Modulate parameters to make it sound dynamic
    if (!this.updateInterval) {
      this.updateInterval = window.setInterval(() => this.modulate(), 50);
    }
  }

  public updateIntensity(intensity: number) {
    this.targetIntensity = Math.min(Math.max(intensity, 0), 1);
  }

  public setVolume(volume: number) {
    if (!this.ctx || !this.masterGain || !this.isPlaying) return;
    this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.1);
  }

  private modulate() {
    if (!this.ctx || !this.isPlaying) return;
    
    const now = this.ctx.currentTime;
    
    // Crackle depends highly on intensity and gets random spikes
    if (this.crackleGain && this.crackleFilter) {
      // Random erratic volume for crackle
      const crackleVol = (this.targetIntensity * 0.8) + (Math.random() * 0.4 * this.targetIntensity);
      this.crackleGain.gain.setTargetAtTime(crackleVol, now, 0.05);
      
      // Filter sweep based on intensity
      this.crackleFilter.frequency.setTargetAtTime(1000 + (this.targetIntensity * 2000), now, 0.1);
    }

    // Rumble is deep and swells slowly
    if (this.rumbleGain && this.rumbleFilter && this.rumbleOsc) {
      // Volume swells
      const rumbleVol = (this.targetIntensity * 0.6) + (Math.sin(now * 5) * 0.2 * this.targetIntensity);
      this.rumbleGain.gain.setTargetAtTime(Math.max(0, rumbleVol), now, 0.2);
      
      // Filter opens up as it gets more intense
      this.rumbleFilter.frequency.setTargetAtTime(100 + (this.targetIntensity * 400), now, 0.2);
      
      // Pitch drops slightly for an ominous feel
      this.rumbleOsc.frequency.setTargetAtTime(40 - (this.targetIntensity * 10), now, 0.5);
    }
  }

  public stop() {
    this.isPlaying = false;
    this.targetIntensity = 0;
    
    if (this.ctx && this.masterGain) {
      // Fade out
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

export const soundEngine = new LightningSoundEngine();
