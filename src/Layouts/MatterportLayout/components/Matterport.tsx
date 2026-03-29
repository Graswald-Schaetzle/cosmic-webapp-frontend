import React, { useEffect, useRef } from 'react';
import { useMatterport } from '../../../contexts/MatterportContext.tsx';
import { MatterTag } from '../../../types/matterport.ts';
import { useDispatch } from 'react-redux';
import {
  openMatterTagWindow,
  closeMatterTagWindow,
  openNewLocationWindow,
} from '../../../store/modalSlice.ts';
import { useGetAllLocationsQuery, LocationItem } from '../../../api/locationApi/locationApi.ts';
import { getMatterTags, addTagToSession } from '../../../app/matterport.ts';

interface MatterportProps {
  children?: React.ReactNode;
}

export default function Matterport({ children }: MatterportProps) {
  const { sdk, setMattertags, mattertags, error, setSdk, setIsLoading, dwellIndicator, clearDwellIndicator } =
    useMatterport();
  const { data: allLocations } = useGetAllLocationsQuery();
  const loadedLocationIds = useRef<Set<string>>(new Set());
  // Maps Matterport session sid → LocationItem so tag clicks can resolve the correct location_id
  const sidToLocationRef = useRef<Map<string, LocationItem>>(new Map());
  // Always holds the latest mattertags list so SDK callbacks don't use a stale closure
  const mattertagsRef = useRef<MatterTag[]>([]);
  useEffect(() => {
    mattertagsRef.current = mattertags;
  }, [mattertags]);

  const dispatch = useDispatch();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleOverlayClick = () => {
    if (!dwellIndicator) return;
    dispatch(
      openNewLocationWindow({
        position: dwellIndicator.worldPos,
        floorId: dwellIndicator.floorId,
      })
    );
    clearDwellIndicator();
  };

  // Re-inject backend locations as ephemeral Matterport tags whenever SDK is ready or locations change
  useEffect(() => {
    console.log('[Matterport] Re-inject effect — sdk:', !!sdk, 'allLocations:', allLocations?.length ?? 0);
    if (!sdk || !allLocations?.length) return;

    const newLocations = allLocations.filter(l => !loadedLocationIds.current.has(String(l.location_id)));
    console.log('[Matterport] New locations to inject:', newLocations.length);
    if (!newLocations.length) return;

    (async () => {
      for (const location of newLocations) {
        const sids = await addTagToSession(sdk, {
          label: location.location_name,
          description: location.description || '',
          x: location.x,
          y: location.y,
          z: location.z,
          tag_type: location.tag_type,
        });
        // Map each returned session sid to this location so tag clicks can resolve location_id
        for (const sid of sids) {
          sidToLocationRef.current.set(sid, location);
        }
        loadedLocationIds.current.add(String(location.location_id));
      }
      // Refresh mattertag list so the context has up-to-date tag IDs
      try {
        const updatedTags = await getMatterTags(sdk);
        setMattertags(updatedTags);
      } catch { /* non-critical */ }
    })();
  }, [sdk, allLocations, setMattertags]);

  useEffect(() => {
    const initMatterport = async () => {
      try {
        if (!iframeRef.current) {
          throw new Error('Matterport iframe not found');
        }

        const modelId = import.meta.env.VITE_MATTERPORT_MODEL_ID;
        const applicationKey = import.meta.env.VITE_MATTERPORT_KEY;

        if (!modelId || !applicationKey) {
          throw new Error('Matterport configuration is missing. Please check your .env file.');
        }

        const mpSdk = await window.connect(iframeRef.current);

        // Mattertag.getData() is the correct call; Tag.data is an IObservable without getData()
        const tags = await getMatterTags(mpSdk);
        setMattertags(tags);

        // Disable default tag behaviors for all pre-existing tags
        for (const tag of tags) {
          if (!tag.sid) continue;
          try {
            await mpSdk.Tag.allowAction(tag.sid, { opening: false, navigating: false, docking: false, transitioning: false });
          } catch {
            try { await mpSdk.Mattertag.preventAction(tag.sid, { opening: true, navigating: true, docking: true, transitioning: true }); } catch { /* not critical */ }
          }
        }

        // Optional: subscribe to tag state changes (dispatch window open/close)
        try {
          mpSdk.Tag.openTags.subscribe({
            prevState: { hovered: null, docked: null, selected: null },
            onChanged(newState: any) {
              const [selected = null] = newState.selected;
              if (selected !== this.prevState.selected) {
                if (selected) {
                  // Prefer resolving via the sid→location map so MatterTagWindow gets location_id
                  const location = sidToLocationRef.current.get(selected);
                  if (location) {
                    dispatch(openMatterTagWindow({
                      location_id: location.location_id,
                      location_name: location.location_name,
                      color: location.color,
                      description: location.description,
                      x: location.x,
                      y: location.y,
                      z: location.z,
                      keywords: location.keywords,
                      floor_id: location.floor_id,
                      room_id: location.room_id,
                      floor_name: location.floor_name,
                      room_name: location.room_name,
                      tasks: location.tasks,
                      taskError: location.taskError,
                      tag_type: location.tag_type,
                      responsible_user_id: location.responsible_user_id,
                      responsible_user: location.responsible_user,
                      created_at: location.created_at,
                    } as any));
                  } else {
                    const tag = mattertagsRef.current.find((t: MatterTag) => t.sid === selected);
                    if (tag) dispatch(openMatterTagWindow(tag));
                  }
                } else {
                  dispatch(closeMatterTagWindow());
                }

              }
              this.prevState = { ...newState, selected };
            },
          });
        } catch { /* Tag.openTags not available in this SDK version */ }

        setSdk(mpSdk);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize Matterport SDK:', err);
        setIsLoading(false);
      }
    };

    initMatterport();
  }, [setSdk, setMattertags, dispatch, setIsLoading]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-500 mb-2">{error}</p>
          <p className="text-sm text-gray-600">
            Please check your Matterport configuration and try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <iframe
        ref={iframeRef}
        className="absolute inset-0 w-full h-full border-0"
        src={`https://my.matterport.com/show/?m=${import.meta.env.VITE_MATTERPORT_MODEL_ID}&applicationKey=${import.meta.env.VITE_MATTERPORT_KEY}&search=0&title=0&play=1&qs=0&brand=0&dh=0&views=0&mls=2&tagNav=0`}
        allow="camera; microphone; fullscreen; display-capture"
      />

      {/* Dwell indicator overlay – only captures clicks when indicator is shown */}
      {dwellIndicator && (
        <div
          onClick={handleOverlayClick}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            cursor: 'crosshair',
          }}
        >
          {/* Animated "+" pin at the dwell position */}
          <div
            style={{
              position: 'absolute',
              left: dwellIndicator.screenX,
              top: dwellIndicator.screenY,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(8px)',
                border: '2px solid rgba(255, 255, 255, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'dwellPulse 1.2s ease-in-out infinite',
                boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
              }}
            >
              <span
                style={{
                  color: 'white',
                  fontSize: 24,
                  lineHeight: 1,
                  fontWeight: 300,
                  userSelect: 'none',
                }}
              >
                +
              </span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dwellPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
        }
      `}</style>

      {children}
    </div>
  );
}
