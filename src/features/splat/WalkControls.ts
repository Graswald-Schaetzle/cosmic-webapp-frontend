import * as THREE from 'three';
import {
  Collider,
  DEFAULT_WALK_PARAMS,
  STANCES,
  Stance,
  StanceShape,
  WalkParams,
  WalkerState,
  createWalkerState,
  floorHeightBelow,
  hasHeadroom,
  jumpVelocity,
  stepWalker,
} from './walkPhysics';

const LOOK_SENSITIVITY = 0.0032;
/** Radians per mouse count while the pointer is locked (mouse look as in a first-person game). */
const MOUSE_LOOK_SENSITIVITY = 0.0022;
/** Some browsers report one huge movement when the lock starts or ends; those are dropped. */
const MAX_MOUSE_STEP = 250;
const MAX_PITCH = Math.PI / 2 - 0.05;
const TAP_MAX_MOVE_PX = 8;
const TAP_MAX_MS = 350;
/** A jump still works this long after the feet left the floor. */
const JUMP_GRACE_S = 0.1;
const MIN_FOV = 40;
const MAX_FOV = 100;
const TARGET_REACHED = 0.15;
/** A glide takes this long at least and at most, in seconds (see flyTo). */
const GLIDE_MIN_S = 0.7;
const GLIDE_MAX_S = 2.4;
const GLIDE_S_PER_M = 0.25;

/** A smooth move to a spot and viewing direction, started with flyTo. */
interface Glide {
  fromFeet: THREE.Vector3;
  toFeet: THREE.Vector3;
  fromYaw: number;
  /** The yaw change along the shorter way round, in radians. */
  deltaYaw: number;
  fromPitch: number;
  toPitch: number;
  elapsed: number;
  duration: number;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export interface WalkControlsOptions {
  /**
   * Called for a short press without dragging, with client coordinates. While the pointer is
   * locked it is the centre of the view, where the crosshair is.
   */
  onTap?: (clientX: number, clientY: number, pointerType: string) => void;
  /** Called when mouse look starts (true) or ends (false), also when the user presses Esc. */
  onLockChange?: (locked: boolean) => void;
  /** Called when the browser refuses to lock the pointer. */
  onLockError?: () => void;
  params?: WalkParams;
}

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
};

/**
 * First-person controls for a splat scene: WASD / arrow keys (Shift to run, Space to jump,
 * C to crouch, Z to lie down), drag to look,
 * on-screen joystick input for touch, pinch to zoom, and "walk to point" targets. Movement is
 * resolved against an optional collision mesh; without one the camera flies freely.
 *
 * With the pointer locked (see requestLock) the mouse turns the view directly, like in a
 * first-person game, and a click acts on the centre of the view.
 */
export class WalkControls {
  enabled = true;
  collider: Collider | null = null;
  readonly walker: WalkerState;
  yaw = 0;
  pitch = 0;
  /** Whether requestLock may lock the pointer; off on touch devices. */
  mouseLook = false;

  /** Joystick vector in [-1, 1]: x = strafe right, y = forward. */
  moveInput = new THREE.Vector2();

  private readonly params: WalkParams;
  /** The params the physics runs with: the body's height follows the stance. */
  private readonly active: WalkParams;
  private currentStance: Stance = 'stand';
  /** Eye height above the feet, eased towards the stance's so a change glides. */
  private eye: number;
  private jumpArmed = false;
  /** Seconds since the feet last touched the floor; ground contact flickers from frame to frame. */
  private sinceGround = Infinity;
  private readonly keys = new Set<string>();
  private readonly pointers = new Map<
    number,
    { x: number; y: number; startX: number; startY: number; startT: number; moved: number }
  >();
  private pinchDistance = 0;
  private target: THREE.Vector3 | null = null;
  private glide: Glide | null = null;
  private readonly smoothedMove = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private lastSafe = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly element: HTMLElement,
    private readonly options: WalkControlsOptions = {}
  ) {
    this.params = options.params ?? DEFAULT_WALK_PARAMS;
    this.active = { ...this.params };
    this.eye = this.params.eyeHeight;
    this.walker = createWalkerState(camera.position);
    this.syncFromCamera();
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointercancel', this.onPointerUp);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('pointerlockerror', this.onLockError);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  /** True while the pointer is locked to the view and the mouse turns the camera. */
  get locked(): boolean {
    return document.pointerLockElement === this.element;
  }

  /** Locks the pointer; must run inside a user gesture (click, key press). */
  requestLock() {
    if (!this.mouseLook || this.locked || !this.element.requestPointerLock) return;
    try {
      // Older browsers return nothing, newer ones a promise that rejects when refused.
      const result = this.element.requestPointerLock() as Promise<void> | undefined;
      result?.catch?.(() => this.options.onLockError?.());
    } catch {
      this.options.onLockError?.();
    }
  }

  exitLock() {
    if (this.locked) document.exitPointerLock();
  }

  dispose() {
    this.exitLock();
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerUp);
    this.element.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('pointerlockerror', this.onLockError);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  get stance(): Stance {
    return this.currentStance;
  }

  /** Eye height above the feet in the current stance, once the view has settled into it. */
  get settledEyeHeight(): number {
    return this.shapeOf(this.currentStance).eyeHeight;
  }

  /** True while the camera glides to a spot started with flyTo. */
  get gliding(): boolean {
    return this.glide !== null;
  }

  private shapeOf(stance: Stance): StanceShape {
    if (stance !== 'stand') return STANCES[stance];
    return {
      height: this.params.height,
      eyeHeight: this.params.eyeHeight,
      speedFactor: 1,
    };
  }

  /** Switches stance; getting taller needs free space above, otherwise nothing changes. */
  private setStance(next: Stance): boolean {
    if (next === this.currentStance) return true;
    const taller = this.shapeOf(next).height > this.shapeOf(this.currentStance).height;
    if (taller && !hasHeadroom(this.collider, this.walker.position, this.shapeOf(next).height))
      return false;
    this.currentStance = next;
    return true;
  }

  /** Stands up as far as the ceiling allows (under a low shelf that is crouching). */
  private standUp() {
    if (!this.setStance('stand')) this.setStance('crouch');
  }

  /** Takes over position and viewing direction from the camera (e.g. when leaving orbit mode). */
  syncFromCamera() {
    this.currentStance = 'stand';
    this.eye = this.params.eyeHeight;
    const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = euler.y;
    this.pitch = THREE.MathUtils.clamp(euler.x, -MAX_PITCH, MAX_PITCH);
    this.walker.position.set(
      this.camera.position.x,
      this.camera.position.y - this.eye,
      this.camera.position.z
    );
    this.walker.verticalVelocity = 0;
    this.walker.onGround = false;
    this.target = null;
    this.glide = null;
    this.lastSafe.copy(this.walker.position);
  }

  /** Puts the walker on the floor below the given point, standing there. */
  placeAt(point: THREE.Vector3) {
    this.glide = null;
    let y = point.y;
    if (this.collider) {
      const floor = floorHeightBelow(this.collider, new THREE.Vector3(point.x, point.y, point.z));
      if (floor !== null) y = floor;
    }
    this.walker.position.set(point.x, y, point.z);
    this.walker.verticalVelocity = 0;
    this.lastSafe.copy(this.walker.position);
    this.applyToCamera();
  }

  lookAt(point: THREE.Vector3) {
    const dx = point.x - this.walker.position.x;
    const dz = point.z - this.walker.position.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.applyToCamera();
  }

  walkTo(point: THREE.Vector3) {
    this.glide = null;
    this.target = point.clone();
  }

  /**
   * Glides the camera to stand at `feet` and look at `lookAt`, easing in and out; `feet` null
   * only turns on the spot. The collision mesh is not consulted on the way, so the caller picks
   * a clear path. `screenX` is where the point should appear across the view, from -1 (left
   * edge) to 1 (right edge), 0 being the middle. Walking or dragging the view takes over again.
   */
  flyTo(feet: THREE.Vector3 | null, lookAt: THREE.Vector3, screenX = 0) {
    const toFeet = feet ? feet.clone() : this.walker.position.clone();
    const eye = toFeet.y + this.settledEyeHeight;
    const dx = lookAt.x - toFeet.x;
    const dz = lookAt.z - toFeet.z;
    const ahead = Math.hypot(dx, dz);
    // Standing right under or over the point, the direction is undefined; keep the heading.
    // Turning the view to the right of the point (a lower yaw) moves the point to the left.
    const halfWidth = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * this.camera.aspect;
    const toYaw = ahead > 1e-3 ? Math.atan2(-dx, -dz) + Math.atan(screenX * halfWidth) : this.yaw;
    const toPitch = THREE.MathUtils.clamp(
      Math.atan2(lookAt.y - eye, Math.max(ahead, 1e-3)),
      -MAX_PITCH,
      MAX_PITCH
    );
    const twoPi = Math.PI * 2;
    const deltaYaw = THREE.MathUtils.euclideanModulo(toYaw - this.yaw + Math.PI, twoPi) - Math.PI;
    this.target = null;
    this.glide = {
      fromFeet: this.walker.position.clone(),
      toFeet,
      fromYaw: this.yaw,
      deltaYaw,
      fromPitch: this.pitch,
      toPitch,
      elapsed: 0,
      duration: Math.min(
        GLIDE_MIN_S + toFeet.distanceTo(this.walker.position) * GLIDE_S_PER_M,
        GLIDE_MAX_S
      ),
    };
  }

  private stepGlide(dt: number) {
    const glide = this.glide;
    if (!glide) return;
    glide.elapsed += dt;
    const t = Math.min(glide.elapsed / glide.duration, 1);
    const eased = easeInOutCubic(t);
    this.walker.position.lerpVectors(glide.fromFeet, glide.toFeet, eased);
    this.walker.verticalVelocity = 0;
    this.yaw = glide.fromYaw + glide.deltaYaw * eased;
    this.pitch = glide.fromPitch + (glide.toPitch - glide.fromPitch) * eased;
    if (t >= 1) {
      this.glide = null;
      this.lastSafe.copy(this.walker.position);
    }
  }

  update(dt: number) {
    if (!this.enabled) return;
    dt = Math.min(dt, 0.1);

    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    let strafe = this.moveInput.x;
    let ahead = this.moveInput.y;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) strafe += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) strafe -= 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ahead += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ahead -= 1;

    const manual = strafe !== 0 || ahead !== 0;
    if (manual) {
      this.target = null;
      this.glide = null;
    }

    if (this.glide) {
      this.smoothedMove.set(0, 0, 0);
      this.stepGlide(dt);
      this.eye +=
        (this.shapeOf(this.currentStance).eyeHeight - this.eye) * (1 - Math.exp(-dt * 10));
      this.applyToCamera();
      return;
    }

    this.desired.set(0, 0, 0);
    if (manual) {
      const length = Math.hypot(strafe, ahead);
      const scale = Math.min(1, length) / length;
      this.desired
        .addScaledVector(this.right, strafe * scale)
        .addScaledVector(this.forward, ahead * scale);
    } else if (this.target) {
      const dx = this.target.x - this.walker.position.x;
      const dz = this.target.z - this.walker.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < TARGET_REACHED) this.target = null;
      else this.desired.set(dx / distance, 0, dz / distance);
    }

    const shape = this.shapeOf(this.currentStance);
    this.active.height = shape.height;
    this.active.eyeHeight = shape.eyeHeight;
    const running =
      this.currentStance === 'stand' && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'));
    const speed = this.params.walkSpeed * shape.speedFactor * (running ? this.params.runFactor : 1);
    this.desired.multiplyScalar(speed);

    // Ease in and out so starting and stopping feels soft rather than abrupt.
    const ease = 1 - Math.exp(-dt * 12);
    this.smoothedMove.lerp(this.desired, ease);

    const before = this.walker.position.clone();
    if (this.collider) {
      this.sinceGround = this.walker.onGround ? 0 : this.sinceGround + dt;
      if (this.jumpArmed && this.currentStance === 'stand' && this.sinceGround < JUMP_GRACE_S) {
        this.walker.verticalVelocity = jumpVelocity(this.params);
        this.walker.onGround = false;
        this.sinceGround = Infinity;
      }
      stepWalker(this.walker, this.smoothedMove, dt, this.collider, this.active);
      // The mesh can have holes; if we ever end up far below it, go back to the last good spot.
      if (this.walker.position.y < this.collider.bounds.min.y - 1) {
        this.walker.position.copy(this.lastSafe);
        this.walker.verticalVelocity = 0;
      } else if (this.walker.onGround) {
        this.lastSafe.copy(this.walker.position);
      }
      // Stuck against a wall while auto-walking: give up on the target.
      if (this.target && before.distanceToSquared(this.walker.position) < 1e-8 * dt)
        this.target = null;
    } else {
      // No collision mesh: move freely in the horizontal plane.
      const fly = new THREE.Vector3(this.smoothedMove.x, 0, this.smoothedMove.z);
      this.walker.position.addScaledVector(fly, dt);
    }
    this.eye += (shape.eyeHeight - this.eye) * (1 - Math.exp(-dt * 10));
    this.applyToCamera();
  }

  private applyToCamera() {
    this.camera.position.set(
      this.walker.position.x,
      this.walker.position.y + this.eye,
      this.walker.position.z
    );
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (
      !this.enabled ||
      isTypingTarget(event.target) ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    if (/^(Key[WASD]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(event.code)) {
      this.keys.add(event.code);
      if (event.code.startsWith('Arrow')) event.preventDefault();
    } else if (event.code === 'Space') {
      // Keep the page from scrolling and a focused button from being pressed.
      event.preventDefault();
      if (event.repeat) return;
      // Like in a shooter, Space first gets you up from crouching or lying; then it jumps.
      if (this.currentStance === 'stand') this.jumpArmed = true;
      else this.standUp();
    } else if (!event.repeat && event.code === 'KeyC') {
      if (this.currentStance === 'crouch') this.standUp();
      else this.setStance('crouch');
    } else if (!event.repeat && event.code === 'KeyZ') {
      if (this.currentStance === 'prone') this.standUp();
      else this.setStance('prone');
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
    if (event.code === 'Space') {
      this.jumpArmed = false;
      if (this.enabled && !isTypingTarget(event.target)) event.preventDefault();
    }
  };

  private onBlur = () => {
    this.keys.clear();
    this.jumpArmed = false;
    this.moveInput.set(0, 0);
  };

  private onLockChange = () => {
    // Pointer states from before the switch would turn into bogus drags or taps.
    this.pointers.clear();
    this.pinchDistance = 0;
    // A button that had focus (a menu used with the secondary button) would react to Space.
    if (this.locked) (document.activeElement as HTMLElement | null)?.blur?.();
    this.options.onLockChange?.(this.locked);
  };

  private onLockError = () => this.options.onLockError?.();

  private onMouseMove = (event: MouseEvent) => {
    if (!this.enabled || !this.locked) return;
    if (Math.abs(event.movementX) > MAX_MOUSE_STEP || Math.abs(event.movementY) > MAX_MOUSE_STEP)
      return;
    this.yaw -= event.movementX * MOUSE_LOOK_SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - event.movementY * MOUSE_LOOK_SENSITIVITY,
      -MAX_PITCH,
      MAX_PITCH
    );
  };

  private onPointerDown = (event: PointerEvent) => {
    // Only the primary button looks and taps; the secondary one is used for the menus.
    if (!this.enabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (!this.locked) this.element.setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startT: performance.now(),
      moved: 0,
    });
    if (this.pointers.size === 2) this.pinchDistance = this.currentPinchDistance();
  };

  private onPointerMove = (event: PointerEvent) => {
    const pointer = this.pointers.get(event.pointerId);
    // While locked the mouse turns the view (onMouseMove) and the pointer position stands still.
    if (!this.enabled || !pointer || this.locked) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.moved = Math.max(
      pointer.moved,
      Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY)
    );

    if (this.pointers.size >= 2) {
      const distance = this.currentPinchDistance();
      if (this.pinchDistance > 0 && distance > 0) {
        this.setFov(this.camera.fov * (this.pinchDistance / distance));
      }
      this.pinchDistance = distance;
      return;
    }
    if (pointer.moved > TAP_MAX_MOVE_PX) {
      this.glide = null;
      this.yaw -= dx * LOOK_SENSITIVITY;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * LOOK_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    const pointer = this.pointers.get(event.pointerId);
    this.pointers.delete(event.pointerId);
    this.pinchDistance = 0;
    if (!this.enabled || !pointer || event.type === 'pointercancel') return;
    const isTap =
      pointer.moved <= TAP_MAX_MOVE_PX && performance.now() - pointer.startT <= TAP_MAX_MS;
    if (!isTap || this.pointers.size !== 0) return;
    if (this.locked) {
      const rect = this.element.getBoundingClientRect();
      this.options.onTap?.(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        event.pointerType
      );
    } else {
      this.options.onTap?.(event.clientX, event.clientY, event.pointerType);
    }
  };

  private onWheel = (event: WheelEvent) => {
    if (!this.enabled) return;
    event.preventDefault();
    this.setFov(this.camera.fov + event.deltaY * 0.03);
  };

  private currentPinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private setFov(fov: number) {
    this.camera.fov = THREE.MathUtils.clamp(fov, MIN_FOV, MAX_FOV);
    this.camera.updateProjectionMatrix();
  }
}
