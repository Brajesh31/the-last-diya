export interface AmbientAudio {
  start(): void;
  setLightLevel(level: number): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function createAmbientAudio(): AmbientAudio {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let windGain: GainNode | null = null;
  let humGain: GainNode | null = null;
  let marketGain: GainNode | null = null;
  let fireGain: GainNode | null = null;
  let fireFilter: BiquadFilterNode | null = null;
  let started = false;
  let targetLevel = 0;
  let currentLevel = 0;
  let windSource: AudioBufferSourceNode | null = null;
  let windFilter: BiquadFilterNode | null = null;
  let fireSource: AudioBufferSourceNode | null = null;
  let humOscillator: OscillatorNode | null = null;
  let marketOscillator: OscillatorNode | null = null;
  let bellTimer = 0;
  let crackleTimer = 0;
  let noiseBuffer: AudioBuffer | null = null;

  function createNoiseBuffer(audioContext: AudioContext) {
    const length = audioContext.sampleRate * 2;
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.985 + white * 0.015;
      data[index] = previous;
    }
    return buffer;
  }

  function start() {
    if (started) return;
    const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;

    context = new AudioContextConstructor();
    master = context.createGain();
    master.gain.value = 0.0001;
    master.connect(context.destination);
    noiseBuffer = createNoiseBuffer(context);

    windGain = context.createGain();
    windGain.gain.value = 0.035;
    windFilter = context.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 700;
    windSource = context.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;
    windSource.connect(windFilter).connect(windGain).connect(master);
    windSource.start();

    fireGain = context.createGain();
    fireGain.gain.value = 0.0001;
    fireFilter = context.createBiquadFilter();
    fireFilter.type = 'bandpass';
    fireFilter.frequency.value = 2100;
    fireFilter.Q.value = 0.65;
    fireSource = context.createBufferSource();
    fireSource.buffer = noiseBuffer;
    fireSource.loop = true;
    fireSource.connect(fireFilter).connect(fireGain).connect(master);
    fireSource.start();

    humGain = context.createGain();
    humGain.gain.value = 0.008;
    humOscillator = context.createOscillator();
    humOscillator.type = 'sine';
    humOscillator.frequency.value = 96;
    humOscillator.connect(humGain).connect(master);
    humOscillator.start();

    marketGain = context.createGain();
    marketGain.gain.value = 0.0001;
    marketOscillator = context.createOscillator();
    marketOscillator.type = 'triangle';
    marketOscillator.frequency.value = 174;
    marketOscillator.connect(marketGain).connect(master);
    marketOscillator.start();

    started = true;
    void context.resume();
  }

  function setLightLevel(level: number) {
    targetLevel = clamp(level, 0, 100);
  }

  function playBell() {
    if (!context || !master || currentLevel < 35) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(620 + Math.random() * 70, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(390, context.currentTime + 1.8);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.025 + currentLevel / 10000, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.8);
    oscillator.connect(gain).connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + 1.9);
  }

  function playCrackle() {
    if (!context || !master || !fireGain || currentLevel < 50) return;
    const now = context.currentTime;
    const peak = 0.012 + Math.random() * 0.018;
    fireGain.gain.cancelScheduledValues(now);
    fireGain.gain.setValueAtTime(Math.max(0.0001, peak), now);
    fireGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06 + Math.random() * 0.12);
  }

  function update(deltaSeconds: number) {
    if (!started || !context || !master || !windGain || !humGain || !marketGain || !windFilter || !fireGain || !fireFilter) return;
    currentLevel += (targetLevel - currentLevel) * Math.min(1, deltaSeconds * 2.5);

    const night = 1 - currentLevel / 100;
    windGain.gain.setTargetAtTime(0.018 + night * 0.045, context.currentTime, 0.35);
    humGain.gain.setTargetAtTime(0.004 + currentLevel / 9000, context.currentTime, 0.5);
    marketGain.gain.setTargetAtTime(currentLevel >= 30 ? Math.min(0.018, (currentLevel - 30) / 3500) : 0.0001, context.currentTime, 0.5);
    windFilter.frequency.setTargetAtTime(450 + night * 550, context.currentTime, 0.5);
    fireFilter.frequency.setTargetAtTime(1700 + currentLevel * 4, context.currentTime, 0.7);
    if (currentLevel < 50) fireGain.gain.setTargetAtTime(0.0001, context.currentTime, 0.6);

    bellTimer -= deltaSeconds;
    if (bellTimer <= 0) {
      bellTimer = 12 + Math.random() * 12;
      playBell();
    }

    crackleTimer -= deltaSeconds;
    if (crackleTimer <= 0) {
      crackleTimer = 0.18 + Math.random() * 0.9;
      playCrackle();
    }
  }

  function dispose() {
    if (!context) return;
    windSource?.stop();
    fireSource?.stop();
    humOscillator?.stop();
    marketOscillator?.stop();
    void context.close();
    context = null;
    started = false;
  }

  return { start, setLightLevel, update, dispose };
}
