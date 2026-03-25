declare module '@mkkellogg/gaussian-splats-3d' {
  import type { Vector3 } from 'three';

  interface ViewerOptions {
    cameraUp?: [number, number, number];
    initialCameraPosition?: [number, number, number];
    initialCameraLookAt?: [number, number, number];
    selfDrivenMode?: boolean;
    useBuiltInControls?: boolean;
    rootElement?: HTMLElement;
    dynamicScene?: boolean;
    sharedMemoryForWorkers?: boolean;
    renderMode?: number;
    sceneRevealMode?: number;
    antialiased?: boolean;
    focalAdjustment?: number;
    logLevel?: number;
    sphericalHarmonicsDegree?: number;
    enableOptionalEffects?: boolean;
    plyInMemoryCompressionLevel?: number;
    freeIntermediateSplatData?: boolean;
    inMemoryCompressionLevel?: number;
    enableSIMDInSort?: boolean;
    gpuAcceleratedSort?: boolean;
    integerBasedSort?: boolean;
    halfPrecisionCovariancesOnGPU?: boolean;
    threeScene?: unknown;
    renderer?: unknown;
    camera?: unknown;
  }

  interface AddSplatSceneOptions {
    showLoadingUI?: boolean;
    progressiveLoad?: boolean;
    format?: number;
    splatAlphaRemovalThreshold?: number;
    position?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    onProgress?: (progress: number, message: string, stage: string) => void;
  }

  interface AbortablePromise<T = void> {
    promise: Promise<T>;
    then: (onResolve: (...args: unknown[]) => unknown) => AbortablePromise;
    catch: (onFail: (error: Error) => void) => AbortablePromise;
    abort: (reason?: string) => void;
  }

  export class Viewer {
    constructor(options?: ViewerOptions);
    addSplatScene(path: string, options?: AddSplatSceneOptions): AbortablePromise;
    start(): void;
    stop(): void;
    dispose(): Promise<void>;
    removeSplatScene(index: number): void;
    setFocalLength(length: number): void;
    getCamera(): unknown;
    getRenderer(): unknown;
    getScene(): unknown;
    cameraUp: Vector3;
    initialCameraPosition: Vector3;
    initialCameraLookAt: Vector3;
  }

  export class DropInViewer extends Viewer {
    constructor(options?: ViewerOptions);
  }

  export const LogLevel: {
    None: number;
    Error: number;
    Warning: number;
    Info: number;
    Debug: number;
  };

  export const SceneRevealMode: {
    Default: number;
    Gradual: number;
    Instant: number;
  };

  export const RenderMode: {
    Always: number;
    OnChange: number;
    Never: number;
  };

  export const SceneFormat: {
    Splat: number;
    Ply: number;
    Spz: number;
    Ksplat: number;
  };

  export const SplatRenderMode: {
    ThreeD: number;
    TwoD: number;
  };
}
