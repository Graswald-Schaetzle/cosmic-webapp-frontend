export interface MatterTag {
  sid?: string;
  label: string;
  description: string;
  anchorPosition: {
    x: number;
    y: number;
    z: number;
  };
  stemVector: {
    x: number;
    y: number;
    z: number;
  };
  color: {
    r: number;
    g: number;
    b: number;
  };
}

export interface TagData {
  title: string;
  description: string;
  date: string;
  priority: string;
  coords?: {
    x: number;
    y: number;
    z: number;
  };
}

export interface DwellIndicator {
  screenX: number;
  screenY: number;
  worldPos: { x: number; y: number; z: number };
  floorId: string;
}

export interface MatterportContextType {
  sdk: any | null;
  pose: any | null;
  intersection: any | null;
  mattertags: MatterTag[];
  setMattertags: (tags: MatterTag[]) => void;
  error: string | null;
  createTag: (data: TagData) => Promise<void>;
  editTag: (id: string, data: Omit<TagData, 'coords'>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  showCreateTaskButton: boolean;
  setShowCreateTaskButton: (show: boolean) => void;
  setSdk: (sdk: any) => void;
  selectedTag: MatterTag | null;
  setSelectedTag: (tag: MatterTag | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  dwellIndicator: DwellIndicator | null;
  clearDwellIndicator: () => void;
}
