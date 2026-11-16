let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function playTone(
  freq: number,
  duration = 0.09,
  type: OscillatorType = 'triangle',
  gainValue = 0.08,
  muted = false,
): void {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Ignore audio context restrictions
  }
}

export function playPlaceSound(value: number, muted: boolean): void {
  const baseFreq = 260 + value * 45;
  playTone(baseFreq, 0.08, 'triangle', 0.09, muted);
}

export function playSelectSound(muted: boolean): void {
  playTone(480, 0.04, 'sine', 0.05, muted);
}

export function playViolationSound(muted: boolean): void {
  playTone(190, 0.22, 'sawtooth', 0.08, muted);
  setTimeout(() => playTone(145, 0.28, 'sawtooth', 0.07, muted), 110);
}

export function playWinSound(muted: boolean): void {
  playTone(523.25, 0.12, 'triangle', 0.09, muted);
  setTimeout(() => playTone(659.25, 0.14, 'triangle', 0.09, muted), 90);
  setTimeout(() => playTone(783.99, 0.22, 'triangle', 0.1, muted), 180);
}
