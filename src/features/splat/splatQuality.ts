export type SplatQuality = 'auto' | 'high' | 'low';

export const QUALITY_LABELS: Record<SplatQuality, string> = {
  auto: 'Auto',
  high: 'Hoch',
  low: 'Niedrig',
};

export interface QualityEnvironment {
  isMobile: boolean;
  devicePixelRatio: number;
  /** navigator.deviceMemory in GB (Chromium only). */
  deviceMemory?: number;
  /** navigator.connection.saveData */
  saveData?: boolean;
}

export interface SplatSource {
  url: string;
  /** Paged .rad file that is streamed in chunks with level of detail. */
  streaming: boolean;
  /** Scale of the splat budget for streamed scenes (1 = Spark's per-platform default). */
  lodSplatScale: number;
  pixelRatio: number;
}

interface NavigatorHints {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

export const readEnvironment = (isMobile: boolean): QualityEnvironment => {
  const hints = (typeof navigator === 'undefined' ? {} : navigator) as NavigatorHints;
  return {
    isMobile,
    devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
    deviceMemory: hints.deviceMemory,
    saveData: hints.connection?.saveData,
  };
};

/** What "Auto" turns into on this device. */
export const autoQuality = (env: QualityEnvironment): 'high' | 'low' =>
  env.saveData || (env.deviceMemory !== undefined && env.deviceMemory <= 2) ? 'low' : 'high';

/**
 * Picks the file and render settings for a quality level.
 * - Niedrig: the small file, no streaming, pixel ratio 1.
 * - Auto: the streamed scene with Spark's default splat budget (it already scales down on phones).
 * - Hoch: the streamed scene with twice the splat budget and full pixel ratio.
 * Without a streamable file every level uses the regular file and only differs in resolution.
 * Returns null when the space has no file at all.
 */
export const resolveSource = (
  quality: SplatQuality,
  files: { splatUrl?: string | null; streamUrl?: string | null },
  env: QualityEnvironment
): SplatSource | null => {
  const { splatUrl, streamUrl } = files;
  const level = quality === 'auto' ? autoQuality(env) : quality;
  const dpr = Math.max(env.devicePixelRatio, 1);

  const wantsStream = level === 'high' && Boolean(streamUrl);
  // A scene that only exists as a streamable file is streamed even on "Niedrig", with a small budget.
  const streaming = wantsStream || (!splatUrl && Boolean(streamUrl));
  const url = streaming ? streamUrl : splatUrl;
  if (!url) return null;

  if (level === 'low') {
    return { url, streaming, lodSplatScale: 0.5, pixelRatio: 1 };
  }
  if (quality === 'high') {
    return { url, streaming, lodSplatScale: 2, pixelRatio: Math.min(dpr, 2) };
  }
  return { url, streaming, lodSplatScale: 1, pixelRatio: Math.min(dpr, env.isMobile ? 1.5 : 2) };
};

const storageKey = (spaceId: number) => `cosmic_splat_quality_${spaceId}`;

export const readQuality = (spaceId: number): SplatQuality => {
  try {
    const value = localStorage.getItem(storageKey(spaceId));
    return value === 'auto' || value === 'high' || value === 'low' ? value : 'auto';
  } catch {
    return 'auto';
  }
};

export const writeQuality = (spaceId: number, quality: SplatQuality) => {
  try {
    localStorage.setItem(storageKey(spaceId), quality);
  } catch {
    // the choice just is not remembered
  }
};

const flipKey = (spaceId: number) => `cosmic_splat_flipped_${spaceId}`;

export const readFlipped = (spaceId: number): boolean => {
  try {
    return localStorage.getItem(flipKey(spaceId)) === '1';
  } catch {
    return false;
  }
};

export const writeFlipped = (spaceId: number, flipped: boolean) => {
  try {
    localStorage.setItem(flipKey(spaceId), flipped ? '1' : '0');
  } catch {
    // the choice just is not remembered
  }
};
