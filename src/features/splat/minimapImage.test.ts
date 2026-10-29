import { describe, expect, it } from 'vitest';
import { IDENTITY_PLACEMENT, SplatPlacement } from './spaceFrame';
import { MinimapFrame, createImageView, findContentCrop } from './minimapImage';

/** A 100 x 100 px image of a 10 x 10 m area; pixel x runs along +x, pixel y along -z. */
const frame: MinimapFrame = { origin: [-5, 0, 5], u: [10, 0, 0], v: [0, 0, -10] };
const image = { width: 100, height: 100 };
const whole = { x: 0, y: 0, width: 100, height: 100 };

describe('findContentCrop', () => {
  const pixels = (width: number, height: number, dark: [number, number][]) => {
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    for (const [x, y] of dark) data.set([0, 0, 0, 255], (y * width + x) * 4);
    return data;
  };

  it('boxes the drawn area and adds the margin', () => {
    const crop = findContentCrop(
      pixels(40, 30, [
        [10, 5],
        [20, 12],
      ]),
      40,
      30,
      2
    );
    expect(crop).toEqual({ x: 8, y: 3, width: 15, height: 12 });
  });

  it('stays inside the image', () => {
    const crop = findContentCrop(
      pixels(10, 10, [
        [0, 0],
        [9, 9],
      ]),
      10,
      10,
      3
    );
    expect(crop).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('ignores transparent pixels and is null for a blank image', () => {
    const blank = new Uint8ClampedArray(10 * 10 * 4);
    expect(findContentCrop(blank, 10, 10, 2)).toBeNull();
  });
});

describe('createImageView', () => {
  it('maps pixels and space positions both ways', () => {
    // The image's origin is at x = -5, and image pixel y = 0 is at z = 5; the placement flips
    // Y and Z for 180 degrees about X, so z = -5 there.
    const flip: SplatPlacement = { scale: 1, rotation_deg: [180, 0, 0], translation: [0, 0, 0] };
    const view = createImageView(frame, flip, image, whole, 200, 200);
    expect(view.width).toBeCloseTo(200);
    expect(view.height).toBeCloseTo(200);
    const [px, py] = view.toScreen(0, 0);
    expect(px).toBeCloseTo(100);
    expect(py).toBeCloseTo(100);
    // The flip puts the image's top at z = -5 and its bottom at z = +5.
    expect(view.toScreen(-5, -5)[0]).toBeCloseTo(0);
    expect(view.toScreen(-5, -5)[1]).toBeCloseTo(0);
    expect(view.toScreen(5, 5)[0]).toBeCloseTo(200);
    expect(view.toScreen(5, 5)[1]).toBeCloseTo(200);
    const [x, z] = view.toPlan(150, 50);
    expect(x).toBeCloseTo(2.5);
    expect(z).toBeCloseTo(-2.5);
  });

  it('shows only the cropped part, scaled to fit', () => {
    const crop = { x: 50, y: 0, width: 50, height: 100 };
    const view = createImageView(frame, IDENTITY_PLACEMENT, image, crop, 100, 100);
    expect(view.width).toBeCloseTo(50);
    expect(view.height).toBeCloseTo(100);
    // x = 0 is the middle of the image, the left edge of the crop.
    expect(view.toScreen(0, 0)[0]).toBeCloseTo(0);
    expect(view.scale).toBeCloseTo(10);
  });

  it('turns a heading by the image axes', () => {
    const view = createImageView(frame, IDENTITY_PLACEMENT, image, whole, 100, 100);
    // Heading 0 is +x, which runs right along the image.
    expect(view.headingToScreen(0)).toBeCloseTo(0);
    // Heading 90 degrees is +z, which runs up the image (pixel y falls with z), i.e. -90 on screen.
    expect(view.headingToScreen(Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
  });

  it('follows a calibration of the space', () => {
    const turned: SplatPlacement = { scale: 1, rotation_deg: [0, 90, 0], translation: [3, 0, 0] };
    const view = createImageView(frame, turned, image, whole, 100, 100);
    const [px, py] = view.toScreen(3, 0);
    expect(px).toBeCloseTo(50);
    expect(py).toBeCloseTo(50);
  });
});
