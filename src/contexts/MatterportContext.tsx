import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  createMatterTag,
  editMatterTag,
  deleteMatterTag,
  getMatterTags,
  injectHTML,
  createFrameHTML,
} from '../app/matterport';
import { DwellIndicator, MatterportContextType, MatterTag, TagData } from '../types/matterport';

// Declare the global connect function
declare global {
  interface Window {
    connect: (iframe: HTMLIFrameElement) => Promise<any>;
  }
}

const MatterportContext = createContext<MatterportContextType | null>(null);

interface MatterportProviderProps {
  children: React.ReactNode;
}

export function MatterportProvider({ children }: MatterportProviderProps) {
  const [sdk, setSdk] = useState<any | null>(null);
  const [pose, setPose] = useState<any | null>(null);
  const [intersection, setIntersection] = useState<any | null>(null);
  const [mattertags, setMattertags] = useState<MatterTag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreateTaskButton, setShowCreateTaskButton] = useState(false);
  const [selectedTag, setSelectedTag] = useState<MatterTag | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dwellIndicator, setDwellIndicator] = useState<DwellIndicator | null>(null);

  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastIntersectionRef = useRef<any | null>(null);

  useEffect(() => {
    if (!sdk) return;

    const initMatterport = async () => {
      try {
        await sdk.Tag.toggleNavControls(false);
        await sdk.Tag.toggleDocking(false);
        await sdk.Tag.toggleSharing(false);
        // Subscribe to camera pose updates
        sdk.Camera.pose.subscribe((newPose: any) => {
          setPose(newPose);
        });

        // Subscribe to pointer intersection updates
        sdk.Pointer.intersection.subscribe((newIntersection: any) => {
          setIntersection(newIntersection);

          if (!newIntersection?.position) return;

          const prev = lastIntersectionRef.current;
          const pos = newIntersection.position;

          // Check if position changed significantly (threshold: 0.05 units)
          const moved =
            !prev ||
            Math.abs(pos.x - prev.x) > 0.05 ||
            Math.abs(pos.y - prev.y) > 0.05 ||
            Math.abs(pos.z - prev.z) > 0.05;

          if (moved) {
            lastIntersectionRef.current = pos;
            setDwellIndicator(null);
            if (dwellTimerRef.current) {
              clearTimeout(dwellTimerRef.current);
            }
            dwellTimerRef.current = setTimeout(async () => {
              try {
                const screenPos = await sdk.Conversion.worldToScreen(pos);
                setDwellIndicator({
                  screenX: screenPos.x,
                  screenY: screenPos.y,
                  worldPos: pos,
                  floorId: newIntersection.floorId || '',
                });
              } catch {
                // worldToScreen may fail if position is off-screen
              }
            }, 3000);
          }
        });

        // Get initial mattertags
        const tags = await getMatterTags(sdk);
        setMattertags(tags);

        // Subscribe to tag state changes
        sdk.Tag.openTags.subscribe({
          prevState: {
            hovered: null,
            docked: null,
            selected: null,
          },
          onChanged(newState: any) {
            if (newState.selected) {
              const tag = mattertags.find(t => t.sid === newState.selected);
              if (tag) {
                setSelectedTag(tag);
              }
            } else {
              setSelectedTag(null);
            }
          },
        });

        // Subscribe to tag data changes
        sdk.Tag.data.subscribe(async (tags: MatterTag[]) => {
          setMattertags(tags);

          // Disable default tag behaviors for all tags
          for (const tag of tags) {
            if (tag.sid) {
              await sdk.Tag.allowAction(tag.sid, {
                opening: false,
                navigating: false,
              });
            }
          }
        });

        // Subscribe to tag clicks
        sdk.Tag.click.subscribe((tagId: string) => {
          const tag = mattertags.find(t => t.sid === tagId);
          if (tag) {
            setSelectedTag(tag);
          }
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to initialize Matterport SDK';
        setError(errorMessage);
        console.error('Matterport SDK initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initMatterport();
  }, [sdk, mattertags]);

  const createTag = async (data: TagData) => {
    if (!sdk) throw new Error('Matterport SDK not initialized');
    if (!data.coords) throw new Error('Coordinates are required for creating a tag');

    const description = `Description: ${data.description}\n\nDate: ${data.date}\n\nPriority: ${data.priority}`;
    const coords = { ...data.coords, y: data.coords.y + 0.5 };

    const tag: MatterTag = {
      label: data.title,
      description,
      anchorPosition: coords,
      stemVector: { x: 0, y: 0, z: 0 },
      color: { r: 0.9, g: 0, b: 0 },
    };

    try {
      const [tagId] = await createMatterTag(sdk, tag);
      const html = createFrameHTML(tagId, 'op1');
      await injectHTML(sdk, tagId, html);

      // Refresh mattertags
      const tags = await getMatterTags(sdk);
      setMattertags(tags);
    } catch (err) {
      console.error('Failed to create tag:', err);
      throw err;
    }
  };

  const editTag = async (id: string, data: Omit<TagData, 'coords'>) => {
    if (!sdk) throw new Error('Matterport SDK not initialized');

    const description = `Description: ${data.description}\n\nDate: ${data.date}\n\nPriority: ${data.priority}`;

    try {
      await editMatterTag(sdk, id, {
        label: data.title,
        description,
      });

      // Refresh mattertags
      const tags = await getMatterTags(sdk);
      setMattertags(tags);
    } catch (err) {
      console.error('Failed to edit tag:', err);
      throw err;
    }
  };

  const clearDwellIndicator = () => {
    setDwellIndicator(null);
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  };

  const deleteTag = async (id: string) => {
    if (!sdk) throw new Error('Matterport SDK not initialized');

    try {
      await deleteMatterTag(sdk, id);

      // Refresh mattertags
      const tags = await getMatterTags(sdk);
      setMattertags(tags);
      setSelectedTag(null);
    } catch (err) {
      console.error('Failed to delete tag:', err);
      throw err;
    }
  };

  const value: MatterportContextType = {
    sdk,
    pose,
    intersection,
    mattertags,
    setMattertags,
    error,
    createTag,
    editTag,
    deleteTag,
    showCreateTaskButton,
    setShowCreateTaskButton,
    setSdk,
    selectedTag,
    setSelectedTag,
    isLoading,
    setIsLoading,
    dwellIndicator,
    clearDwellIndicator,
  };

  return <MatterportContext.Provider value={value}>{children}</MatterportContext.Provider>;
}

export function useMatterport() {
  const context = useContext(MatterportContext);
  if (!context) {
    throw new Error('useMatterport must be used within a MatterportProvider');
  }
  return context;
}
