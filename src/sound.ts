// Synthesized sound effects via the Web Audio API — no audio files to bundle.
// All sounds are short envelopes; muting is persisted to localStorage.

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem('mf-muted') === '1';
} catch {
  muted = false;
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function isMuted(): boolean {
  return muted;
}
export function setMuted(v: boolean): void {
  muted = v;
  try {
    localStorage.setItem('mf-muted', v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain = 0.18) {
  const c = ac();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(start: number, dur: number, gain = 0.12) {
  const c = ac();
  if (!c) return;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  const filt = c.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 1200;
  src.connect(filt).connect(g).connect(c.destination);
  src.start(c.currentTime + start);
}

function guard(fn: () => void) {
  if (muted) return;
  try {
    fn();
  } catch {
    /* audio is best-effort */
  }
}

export const sound = {
  dice: () => guard(() => {
    // a quick rattle then a settle thunk
    noise(0, 0.12, 0.1);
    noise(0.12, 0.1, 0.08);
    tone(180, 0.24, 0.12, 'square', 0.12);
  }),
  build: () => guard(() => tone(140, 0, 0.14, 'square', 0.16)),
  route: () => guard(() => tone(220, 0, 0.1, 'triangle', 0.13)),
  research: () => guard(() => {
    tone(660, 0, 0.1, 'sine', 0.14);
    tone(990, 0.08, 0.12, 'sine', 0.12);
  }),
  claim: () => guard(() => {
    [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.18, 'triangle', 0.14));
  }),
  storm: () => guard(() => {
    noise(0, 0.5, 0.14);
    tone(90, 0, 0.5, 'sawtooth', 0.1);
  }),
  win: () => guard(() => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.4, 'triangle', 0.16));
  }),
  error: () => guard(() => tone(110, 0, 0.18, 'sawtooth', 0.12)),
};
