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
import { useIsMobile } from '../hooks/useIsMobile';

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

  const isMobile = useIsMobile();
  const isMobileRef = useRef(isMobile);
  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastIntersectionRef = useRef<any | null>(null);
  const poseRef = useRef<any | null>(null);

  // Desktop dwell detection: track last stable screen position
  const touchStablePosRef = useRef<{ x: number; y: number } | null>(null);
  const touchStableStartMsRef = useRef<number>(0);

  // Mobile long-press detection: native touch events are reliable regardless of
  // whether Pointer.intersection fires while the finger is stationary.
  const touchDwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartClientRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!sdk) return;

    const initMatterport = async () => {
      try {
        // Optional Tag UI controls — may not exist in all SDK versions
        try {
          await sdk.Tag.toggleNavControls(false);
        } catch {
          /* not available */
        }
        try {
          await sdk.Tag.toggleDocking(false);
        } catch {
          /* not available */
        }
        try {
          await sdk.Tag.toggleSharing(false);
        } catch {
          /* not available */
        }

        // Subscribe to camera pose updates (required for worldToScreen)
        sdk.Camera.pose.subscribe((newPose: any) => {
          setPose(newPose);
          poseRef.current = newPose;
        });

        // Helper to get window size efficiently
        const getWindowSize = () => {
          const iframe = document.querySelector('iframe');
          return {
            w: iframe?.clientWidth || window.innerWidth,
            h: iframe?.clientHeight || window.innerHeight,
          };
        };

        // Subscribe to pointer intersection updates (required for dwell detection)
        sdk.Pointer.intersection.subscribe((newIntersection: any) => {
          setIntersection(newIntersection);

          if (!newIntersection?.position || !poseRef.current) return;

          const pos = newIntersection.position;
          const { w, h } = getWindowSize();

          let screenPos;
          try {
            screenPos = sdk.Conversion.worldToScreen(pos, poseRef.current, { w, h });
          } catch (e) {
            return; // Cannot compute screen pos
          }

          const currentScreenPos = { x: screenPos.x, y: screenPos.y };
          const pxThreshold = 15;

          lastIntersectionRef.current = {
            worldPos: pos,
            screenPos: currentScreenPos,
            floorId: newIntersection.floorId ?? newIntersection.floorIndex ?? '',
          };

          if (isMobileRef.current) {
            // Mobile dwell is driven by native touch event listeners (see useEffect
            // below). We only need lastIntersectionRef kept up-to-date for position.
            return;
          }

          // DESKTOP: original idle-based dwell timer
          const prevScreenPos = touchStablePosRef.current;
          const moved =
            !prevScreenPos ||
            Math.abs(currentScreenPos.x - prevScreenPos.x) > pxThreshold ||
            Math.abs(currentScreenPos.y - prevScreenPos.y) > pxThreshold;

          if (moved) {
            touchStablePosRef.current = currentScreenPos;

            if (dwellTimerRef.current) {
              clearTimeout(dwellTimerRef.current);
            }

            setDwellIndicator(null);

            dwellTimerRef.current = setTimeout(() => {
              const saved = lastIntersectionRef.current;
              if (!saved) return;

              const x = saved.screenPos.x;
              const y = saved.screenPos.y;

              if (x > 0 && y > 0 && x < w && y < h) {
                setDwellIndicator({
                  screenX: x,
                  screenY: y,
                  worldPos: saved.worldPos,
                  floorId: String(saved.floorId),
                });
              } else {
                setDwellIndicator({
                  screenX: w / 2,
                  screenY: h / 2,
                  worldPos: saved.worldPos,
                  floorId: String(saved.floorId),
                });
              }
            }, 3000);
          }
        });

        // Get initial mattertags
        const tags = await getMatterTags(sdk);
        setMattertags(tags);

        // Optional: subscribe to tag state changes
        try {
          sdk.Tag.openTags.subscribe({
            prevState: { hovered: null, docked: null, selected: null },
            onChanged(newState: any) {
              if (newState.selected) {
                const tag = mattertags.find(t => t.sid === newState.selected);
                if (tag) setSelectedTag(tag);
              } else {
                setSelectedTag(null);
              }
            },
          });
        } catch {
          /* Tag.openTags not available */
        }

        // Optional: subscribe to tag data changes
        try {
          sdk.Tag.data.subscribe(async (tags: MatterTag[]) => {
            setMattertags(tags);
            for (const tag of tags) {
              if (tag.sid) {
                try {
                  await sdk.Tag.allowAction(tag.sid, { opening: false, navigating: false });
                } catch {
                  /* allowAction not available */
                }
              }
            }
          });
        } catch {
          /* Tag.data not available */
        }

        // Optional: subscribe to tag clicks
        try {
          sdk.Tag.click.subscribe((tagId: string) => {
            const tag = mattertags.find(t => t.sid === tagId);
            if (tag) setSelectedTag(tag);
          });
        } catch {
          /* Tag.click not available */
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk]);

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

  // Mobile long-press via native touch events. Pointer.intersection fires only on
  // pointer *move*, not while the finger is stationary, so the previous interval
  // approach timed out immediately on a still hold. Window-level touch events are
  // reliable and don't interfere with the Matterport iframe's own touch handling.
  useEffect(() => {
    if (!isMobile || !sdk) return;

    const DWELL_MS = 3000;
    const MOVE_THRESHOLD_PX = 15;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartClientRef.current = { x: touch.clientX, y: touch.clientY };

      if (touchDwellTimerRef.current) clearTimeout(touchDwellTimerRef.current);

      touchDwellTimerRef.current = setTimeout(() => {
        touchStartClientRef.current = null;
        const saved = lastIntersectionRef.current;
        if (!saved) return;
        const iframe = document.querySelector('iframe');
        const cw = iframe?.clientWidth || window.innerWidth;
        const ch = iframe?.clientHeight || window.innerHeight;
        const sx = saved.screenPos.x;
        const sy = saved.screenPos.y;
        const inBounds = sx > 0 && sy > 0 && sx < cw && sy < ch;
        setDwellIndicator({
          screenX: inBounds ? sx : cw / 2,
          screenY: inBounds ? sy : ch / 2,
          worldPos: saved.worldPos,
          floorId: String(saved.floorId),
        });
      }, DWELL_MS);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartClientRef.current || !touchDwellTimerRef.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartClientRef.current.x;
      const dy = touch.clientY - touchStartClientRef.current.y;
      if (Math.abs(dx) > MOVE_THRESHOLD_PX || Math.abs(dy) > MOVE_THRESHOLD_PX) {
        clearTimeout(touchDwellTimerRef.current);
        touchDwellTimerRef.current = null;
        touchStartClientRef.current = null;
        setDwellIndicator(null);
      }
    };

    const handleTouchEnd = () => {
      if (touchDwellTimerRef.current) {
        clearTimeout(touchDwellTimerRef.current);
        touchDwellTimerRef.current = null;
      }
      touchStartClientRef.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      if (touchDwellTimerRef.current) {
        clearTimeout(touchDwellTimerRef.current);
        touchDwellTimerRef.current = null;
      }
    };
  }, [isMobile, sdk]);

  const clearDwellIndicator = () => {
    setDwellIndicator(null);
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
    if (touchDwellTimerRef.current) {
      clearTimeout(touchDwellTimerRef.current);
      touchDwellTimerRef.current = null;
    }
    touchStartClientRef.current = null;
    touchStablePosRef.current = null;
    touchStableStartMsRef.current = 0;
  };

  useEffect(() => {
    return () => {
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
      if (touchDwellTimerRef.current) {
        clearTimeout(touchDwellTimerRef.current);
        touchDwellTimerRef.current = null;
      }
    };
  }, []);

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
