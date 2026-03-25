declare module '@matterport/sdk' {
  export interface SDK {
    Camera: {
      pose: {
        subscribe: (callback: (pose: Pose) => void) => void;
      };
    };
    Pointer: {
      intersection: {
        subscribe: (callback: (intersection: Intersection) => void) => void;
      };
    };
    Conversion: {
      worldToScreen: (position: Position, pose: Pose, size: { w: number; h: number }) => ScreenPosition;
    };
    Renderer: {
      getSize: () => Size;
    };
    Tag: {
      add: (tags: MatterTag[]) => Promise<string[]>;
      remove: (tagId: string) => Promise<void>;
      editBillboard: (tagId: string, updates: Partial<MatterTag>) => Promise<void>;
      editColor: (tagId: string, color: { r: number; g: number; b: number }) => Promise<void>;
      injectHTML: (tagId: string, html: string) => Promise<void>;
      allowAction: (tagId: string, actions: { opening?: boolean; navigating?: boolean }) => Promise<void>;
      data: {
        subscribe: (callback: (tags: MatterTag[]) => void) => void;
        getData: () => Promise<MatterTag[]>;
      };
      openTags: {
        subscribe: (observer: any) => void;
      };
      click: {
        subscribe: (callback: (tagId: string) => void) => void;
      };
      toggleNavControls: (show: boolean) => Promise<void>;
      toggleDocking: (show: boolean) => Promise<void>;
      toggleSharing: (show: boolean) => Promise<void>;
    };
  }

  export interface Pose {
    position: Position;
    rotation: Rotation;
  }

  export interface Position {
    x: number;
    y: number;
    z: number;
  }

  export interface Rotation {
    x: number;
    y: number;
    z: number;
  }

  export interface Intersection {
    position: Position;
    normal: Position;
    distance: number;
    floorId: string;
  }

  export interface Size {
    width: number;
    height: number;
  }

  export interface ScreenPosition {
    x: number;
    y: number;
  }

  export interface MatterTag {
    label: string;
    description: string;
    anchorPosition: Position;
    stemVector: Position;
    color: {
      r: number;
      g: number;
      b: number;
    };
    sid?: string;
  }

  export function connect(element: HTMLElement): Promise<SDK>;
}
