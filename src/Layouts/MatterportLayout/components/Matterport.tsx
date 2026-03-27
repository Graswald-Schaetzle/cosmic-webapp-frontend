import React, { useEffect, useRef } from 'react';
import { useMatterport } from '../../../contexts/MatterportContext.tsx';
import { MatterTag } from '../../../types/matterport.ts';
import { useDispatch } from 'react-redux';
import {
  openMatterTagWindow,
  closeMatterTagWindow,
  openNewLocationWindow,
} from '../../../store/modalSlice.ts';
import { useGetAllLocationsQuery } from '../../../api/locationApi/locationApi.ts';

interface MatterportProps {
  children?: React.ReactNode;
}

export default function Matterport({ children }: MatterportProps) {
  const { sdk, mattertags, setMattertags, error, setSdk, setIsLoading, dwellIndicator, clearDwellIndicator } =
    useMatterport();
  const { data: allLocations } = useGetAllLocationsQuery();
  const loadedLocationIds = useRef<Set<string>>(new Set());

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
    if (!sdk || !allLocations?.length) return;

    const newLocations = allLocations.filter(l => !loadedLocationIds.current.has(l.location_id));
    if (!newLocations.length) return;

    (async () => {
      for (const location of newLocations) {
        const hex = (location.color || '#ff0000').replace('#', '');
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;

        try {
          await sdk.Tag.add([{
            label: location.location_name,
            description: location.description || '',
            anchorPosition: { x: location.x, y: location.y, z: location.z },
            stemVector: { x: 0, y: 0, z: 0 },
            color: { r, g, b },
          }]);
          loadedLocationIds.current.add(location.location_id);
        } catch {
          // continue with other locations
        }
      }
      try {
        const updatedTags = await sdk.Tag.data.getData();
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

        // Get initial mattertags (Tag.data.getData preferred, fallback to Mattertag.getData)
        let tags: MatterTag[] = [];
        try {
          tags = await mpSdk.Tag.data.getData();
        } catch {
          try { tags = await mpSdk.Mattertag.getData(); } catch { /* no tags */ }
        }
        setMattertags(tags);

        // Disable default tag behaviors for all tags
        tags.forEach((tag: MatterTag) => {
          if (tag.sid) {
            mpSdk.Tag.allowAction(tag.sid, {
              opening: false,
              navigating: false,
            });
          }
        });

        // Optional: subscribe to tag state changes (dispatch window open/close)
        try {
          mpSdk.Tag.openTags.subscribe({
            prevState: { hovered: null, docked: null, selected: null },
            onChanged(newState: any) {
              const [selected = null] = newState.selected;
              if (selected !== this.prevState.selected) {
                if (selected) {
                  const tag = tags.find((t: MatterTag) => t.sid === selected);
                  if (tag) dispatch(openMatterTagWindow(tag));
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

      {/* DEBUG PANEL */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 100, background: 'rgba(0,0,0,0.7)', color: 'lime', padding: 10, fontFamily: 'monospace', fontSize: 12, pointerEvents: 'none' }}>
        <div>Matterport SDK loaded: {sdk ? 'Yes' : 'No'}</div>
        <div>Tags loaded: {mattertags?.length || 0}</div>
        <div>Dwell Indicator Set: {dwellIndicator ? 'YES' : 'NO'}</div>
      </div>

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
