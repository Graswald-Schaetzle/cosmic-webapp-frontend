import * as THREE from 'three';
import {
  SplatEdit,
  SplatEditRgbaBlendMode,
  SplatEditSdf,
  SplatEditSdfType,
} from '@sparkjsdev/spark';

/**
 * Makes every splat above a world-space height invisible, used to take the ceiling off in the
 * dollhouse view. Add `edit` to the scene while the cut is wanted and remove it afterwards.
 */
export class CeilingCut {
  readonly edit: SplatEdit;
  private readonly plane: SplatEditSdf;

  constructor() {
    this.plane = new SplatEditSdf({ type: SplatEditSdfType.PLANE, opacity: 0 });
    // A plane is "inside" where its local z is negative; turning local z into world +y and
    // inverting the edit makes the half-space above the plane the removed one.
    this.plane.rotation.x = -Math.PI / 2;
    this.edit = new SplatEdit({
      name: 'ceiling-cut',
      rgbaBlendMode: SplatEditRgbaBlendMode.MULTIPLY,
      invert: true,
      sdfs: [this.plane],
    });
    this.edit.add(this.plane);
  }

  setHeight(y: number) {
    this.plane.position.set(0, y, 0);
    this.plane.updateMatrixWorld(true);
  }
}

/** Height of the cut: just below the top of the scene so floor and walls stay, ceiling goes. */
export const ceilingCutHeight = (bounds: THREE.Box3): number => {
  const height = bounds.max.y - bounds.min.y;
  return bounds.max.y - Math.max(0.3, height * 0.1);
};
