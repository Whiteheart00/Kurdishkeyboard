import { SoundPackId } from '../types/keyboard';

export interface SoundPackMeta {
  id: SoundPackId;
  labelKu: string;
  subtitle: string;
  files?: {
    standard: string;
    space: string;
    delete: string;
  };
}

export const SOUND_PACKS: SoundPackMeta[] = [
  {
    id: 'modern',
    labelKu: 'مۆدێرن (Modern)',
    subtitle: 'دەنگی نەرم و مۆدێرن (WAV)',
    files: {
      standard: '/assets/aistudio/fx_modern_standard_c42303bf.wav',
      space: '/assets/aistudio/fx_modern_spacebar_3878e2cc.wav',
      delete: '/assets/aistudio/fx_modern_delete_441ff561.wav',
    },
  },
  {
    id: 'blip',
    labelKu: 'بلیپ (Blip)',
    subtitle: 'دەنگی کورت و تیژ (MP3)',
    files: {
      standard: '/assets/aistudio/fx_blip_standard_eb8d8d7d.mp3',
      space: '/assets/aistudio/fx_blip_spacebar_5ee8c523.mp3',
      delete: '/assets/aistudio/fx_blip_delete_8ff6000d.mp3',
    },
  },
  {
    id: 'surface',
    labelKu: 'سێرفەیس (Surface)',
    subtitle: 'دەنگی میکانیکی نەرم (OGG)',
    files: {
      standard: '/assets/aistudio/fx_surface_standard_c20acb96.ogg',
      space: '/assets/aistudio/fx_surface_space_005f9c96.ogg',
      delete: '/assets/aistudio/fx_surface_delete_d48c157b.ogg',
    },
  },
  {
    id: 'traditional',
    labelKu: 'کلاسیک (Traditional)',
    subtitle: 'دەنگی کلاسیکی ئەندرۆید (MP3)',
    files: {
      standard: '/assets/aistudio/fx_traditional_standard_b7811287.mp3',
      space: '/assets/aistudio/fx_traditional_function_2b9aca9b.mp3',
      delete: '/assets/aistudio/fx_traditional_function_2b9aca9b.mp3',
    },
  },
  {
    id: 'synth',
    labelKu: 'دیجیتاڵی سادە',
    subtitle: 'دەنگی خێرای ناوخۆیی بێ فایل',
  },
];

let audioCtx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();
const pendingLoads = new Map<string, Promise<AudioBuffer | null>>();

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextCtor) {
      audioCtx = new AudioContextCtor();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

async function loadAudioBuffer(url: string, ctx: AudioContext): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(url);
  if (cached) return cached;
  const inflight = pendingLoads.get(url);
  if (inflight) return inflight;

  const promise = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error('Audio fetch failed');
      return r.arrayBuffer();
    })
    .then((arr) => ctx.decodeAudioData(arr))
    .then((decoded) => {
      bufferCache.set(url, decoded);
      pendingLoads.delete(url);
      return decoded;
    })
    .catch(() => {
      pendingLoads.delete(url);
      return null;
    });

  pendingLoads.set(url, promise);
  return promise;
}

export function preloadSoundPack(packId: SoundPackId) {
  const pack = SOUND_PACKS.find((p) => p.id === packId);
  if (!pack?.files) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  loadAudioBuffer(pack.files.standard, ctx);
  loadAudioBuffer(pack.files.space, ctx);
  loadAudioBuffer(pack.files.delete, ctx);
}

function playSynthFallback(
  ctx: AudioContext,
  type: 'char' | 'space' | 'backspace' | 'enter' | 'special',
  volume: number
) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const v = Math.max(0.02, Math.min(1, volume)) * 0.11;

  if (type === 'space') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.035);
    gain.gain.setValueAtTime(v, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  } else if (type === 'backspace') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.03);
    gain.gain.setValueAtTime(v * 0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
  } else if (type === 'enter') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.045);
    gain.gain.setValueAtTime(v * 0.95, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  } else {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(type === 'special' ? 520 : 620, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.022);
    gain.gain.setValueAtTime(v * 0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.026);
  }

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.055);
}

export function playKeyFeedback(
  type: 'char' | 'space' | 'backspace' | 'enter' | 'special',
  soundEnabled: boolean,
  vibrationEnabled: boolean,
  soundPack: SoundPackId = 'modern',
  volume = 0.75,
  vibrationDurationMs = 16
) {
  if (vibrationEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      const baseMs = Math.max(6, Math.min(60, Math.round(vibrationDurationMs || 16)));
      const dur = type === 'backspace' || type === 'enter' ? Math.min(65, Math.round(baseMs * 1.35)) : baseMs;
      navigator.vibrate(dur);
    } catch {
      // Ignore unsupported environments
    }
  }

  if (!soundEnabled) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const pack = SOUND_PACKS.find((p) => p.id === soundPack);
  if (!pack?.files) {
    try {
      playSynthFallback(ctx, type, volume);
    } catch {
      // ignore
    }
    return;
  }

  const targetUrl =
    type === 'space'
      ? pack.files.space
      : type === 'backspace' || type === 'enter'
      ? pack.files.delete
      : pack.files.standard;

  const cached = bufferCache.get(targetUrl);
  if (cached) {
    try {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = cached;
      gain.gain.value = Math.max(0.05, Math.min(1, volume));
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0);
    } catch {
      // ignore
    }
    return;
  }

  // Trigger decode & play immediately once decoded (and play synth right now on first tap for zero latency)
  loadAudioBuffer(targetUrl, ctx).then((buf) => {
    if (!buf) return;
    try {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buf;
      gain.gain.value = Math.max(0.05, Math.min(1, volume));
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0);
    } catch {
      // ignore
    }
  });
}
