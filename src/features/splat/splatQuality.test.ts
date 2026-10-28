import { describe, expect, it } from 'vitest';
import { QualityEnvironment, autoQuality, resolveSource } from './splatQuality';

const desktop: QualityEnvironment = { isMobile: false, devicePixelRatio: 2 };
const phone: QualityEnvironment = { isMobile: true, devicePixelRatio: 3 };
const files = { splatUrl: 'https://x/small.spz', streamUrl: 'https://x/full.rad' };

describe('resolveSource', () => {
  it('uses the small file on Niedrig', () => {
    expect(resolveSource('low', files, desktop)).toEqual({
      url: files.splatUrl,
      streaming: false,
      lodSplatScale: 0.5,
      pixelRatio: 1,
    });
  });

  it('streams the large scene with a bigger budget on Hoch', () => {
    expect(resolveSource('high', files, phone)).toEqual({
      url: files.streamUrl,
      streaming: true,
      lodSplatScale: 2,
      pixelRatio: 2,
    });
  });

  it('streams with the default budget on Auto and caps the pixel ratio on phones', () => {
    expect(resolveSource('auto', files, phone)).toMatchObject({
      streaming: true,
      lodSplatScale: 1,
      pixelRatio: 1.5,
    });
  });

  it('falls back to the small file on Auto when the device asks for less data', () => {
    const env = { ...desktop, saveData: true };
    expect(autoQuality(env)).toBe('low');
    expect(resolveSource('auto', files, env)).toMatchObject({
      url: files.splatUrl,
      streaming: false,
    });
    expect(autoQuality({ ...desktop, deviceMemory: 2 })).toBe('low');
    expect(autoQuality({ ...desktop, deviceMemory: 8 })).toBe('high');
  });

  it('uses the regular file on every level when there is nothing to stream', () => {
    for (const quality of ['auto', 'high', 'low'] as const) {
      expect(resolveSource(quality, { splatUrl: files.splatUrl }, desktop)).toMatchObject({
        url: files.splatUrl,
        streaming: false,
      });
    }
  });

  it('streams a stream-only scene even on Niedrig', () => {
    expect(resolveSource('low', { streamUrl: files.streamUrl }, desktop)).toMatchObject({
      url: files.streamUrl,
      streaming: true,
      pixelRatio: 1,
    });
  });

  it('returns null without any file', () => {
    expect(resolveSource('auto', {}, desktop)).toBeNull();
  });
});
