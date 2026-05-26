export class LightningSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // Master mix
  private crackleGain: GainNode | null = null;
  private backgroundNoise: AudioBufferSourceNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private isPlaying = false;
  private targetIntensity = 0;
  private updateInterval: number | null = null;
  
  public pitch = 40;
  public crackle = 0.8;

  public init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0; // Start silent
    this.masterGain.connect(this.ctx.destination);

    // --- Pre-generate Noise Buffer for Sparks ---
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1);
    }

    // --- Setup Background Crackle ---
    this.backgroundNoise = this.ctx.createBufferSource();
    this.backgroundNoise.buffer = this.noiseBuffer;
    this.backgroundNoise.loop = true;

    this.crackleGain = this.ctx.createGain();
    this.crackleGain.gain.value = 0;
    
    // Highpass to keep it crisp
    const crackleFilter = this.ctx.createBiquadFilter();
    crackleFilter.type = 'highpass';
    crackleFilter.frequency.value = 800;

    this.backgroundNoise.connect(crackleFilter);
    crackleFilter.connect(this.crackleGain);
    this.crackleGain.connect(this.masterGain);

    this.backgroundNoise.start();
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
    // Moderate background crackle based on intensity
    if (this.crackleGain) {
      const crackleVol = (this.targetIntensity * 0.1) * this.crackle;
      this.crackleGain.gain.setTargetAtTime(crackleVol, now, 0.1);
    }

    // Randomly spawn sparks (zaps and cracks) based on intensity
    if (this.targetIntensity > 0.1) {
      // The higher the intensity, the higher the chance of a spark
      if (Math.random() < this.targetIntensity * this.crackle) {
        this.triggerSpark();
      }
    }
  }

  private triggerSpark() {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = this.ctx.currentTime;
    
    // Spark noise source
    const sparkSource = this.ctx.createBufferSource();
    sparkSource.buffer = this.noiseBuffer;
    
    // Bandpass filter to make it sound like an electric snap
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    // Use pitch to determine the center frequency of the snap (40-100 mapped to 800-4000Hz)
    const baseFreq = 800 + ((this.pitch - 20) / 80) * 3200;
    // Add some random variation
    filter.frequency.value = baseFreq + (Math.random() * 1000 - 500);
    filter.Q.value = 1 + Math.random() * 2;

    // Envelope for a sharp, percussive crack
    const gainNode = this.ctx.createGain();
    const peakVolume = (0.3 + Math.random() * 0.7) * this.targetIntensity * this.crackle;
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(peakVolume, now + 0.01);
    // Exponential decay for the electric zap sound
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05 + Math.random() * 0.1);

    sparkSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    // Randomize playback rate slightly for different spark textures
    sparkSource.playbackRate.value = 0.8 + Math.random() * 0.6;
    
    sparkSource.start(now);
    // Stop and cleanup after the decay
    sparkSource.stop(now + 0.3);
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
