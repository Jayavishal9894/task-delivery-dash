// Web Audio alarm tones + Vibration API helpers.
// Tones are synthesized so there's no audio asset dependency.

export type AlarmTone = "beep" | "klaxon" | "chime";

const SETTINGS_KEY = "trackit.settings.v1";

export type AppSettings = {
  alarmTone: AlarmTone;
  alarmEnabled: boolean;
  vibrateEnabled: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  alarmTone: "beep",
  alarmEnabled: true,
  vibrateEnabled: true,
};

export const loadSettings = (): AppSettings => {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (s: AppSettings) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
};

let ctx: AudioContext | null = null;
let loopTimer: ReturnType<typeof setInterval> | null = null;
let vibrateTimer: ReturnType<typeof setInterval> | null = null;
let activeNodes: AudioNode[] = [];

const getCtx = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  if (!ctx) ctx = new C();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
};

const ramp = (param: AudioParam, target: number, time: number) => {
  param.cancelScheduledValues(time);
  param.linearRampToValueAtTime(target, time);
};

const playBeep = () => {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(880, t);
  gain.gain.setValueAtTime(0, t);
  ramp(gain.gain, 0.35, t + 0.02);
  ramp(gain.gain, 0, t + 0.25);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.3);
  activeNodes.push(osc, gain);
};

const playKlaxon = () => {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.linearRampToValueAtTime(660, t + 0.4);
  osc.frequency.linearRampToValueAtTime(220, t + 0.8);
  gain.gain.setValueAtTime(0, t);
  ramp(gain.gain, 0.3, t + 0.05);
  ramp(gain.gain, 0, t + 0.85);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.9);
  activeNodes.push(osc, gain);
};

const playChime = () => {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
  freqs.forEach((f, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f, t);
    gain.gain.setValueAtTime(0, t + i * 0.12);
    ramp(gain.gain, 0.25, t + i * 0.12 + 0.02);
    ramp(gain.gain, 0, t + i * 0.12 + 0.8);
    osc.connect(gain).connect(c.destination);
    osc.start(t + i * 0.12);
    osc.stop(t + i * 0.12 + 0.85);
    activeNodes.push(osc, gain);
  });
};

const TONES: Record<AlarmTone, { play: () => void; interval: number }> = {
  beep: { play: playBeep, interval: 450 },
  klaxon: { play: playKlaxon, interval: 1000 },
  chime: { play: playChime, interval: 1300 },
};

export const previewTone = (tone: AlarmTone) => {
  TONES[tone].play();
};

export const startAlarm = (tone: AlarmTone) => {
  stopAlarm();
  const t = TONES[tone] ?? TONES.beep;
  t.play();
  loopTimer = setInterval(t.play, t.interval);
};

export const stopAlarm = () => {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
  activeNodes = [];
};

export const startVibration = () => {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  const pattern = [400, 200, 400, 200, 600];
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
  vibrateTimer = setInterval(() => {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }, 2200);
};

export const stopVibration = () => {
  if (vibrateTimer) {
    clearInterval(vibrateTimer);
    vibrateTimer = null;
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(0);
    } catch {
      /* ignore */
    }
  }
};