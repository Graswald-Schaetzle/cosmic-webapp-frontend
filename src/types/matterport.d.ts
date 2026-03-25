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
      worldToScreen: (position: Position) => ScreenPosition;
    };
    Renderer: {
      getSize: () => Size;
    };
    Mattertag: {
      add: (tags: MatterTag[]) => Promise<string[]>;
      editBillboard: (tagId: string, updates: Partial<MatterTag>) => Promise<void>;
      getData: () => Promise<MatterTag[]>;
      injectHTML: (tagId: string, html: string) => Promise<void>;
    };
    Tag: {
      remove: (tagId: string) => Promise<void>;
      editColor: (tagId: string, color: { r: number; g: number; b: number }) => Promise<void>;
      data: MatterTag[];
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
