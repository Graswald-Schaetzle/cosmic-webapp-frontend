import React, { useEffect, useRef } from 'react';
import { useMatterport } from '../../../contexts/MatterportContext.tsx';
import { MatterTag } from '../../../types/matterport.ts';
import { useDispatch } from 'react-redux';
import { openMatterTagWindow, closeMatterTagWindow } from '../../../store/modalSlice.ts';

interface MatterportProps {
  children?: React.ReactNode;
}

export default function Matterport({ children }: MatterportProps) {
  const { setMattertags, error, setSdk, setIsLoading } = useMatterport();

  const dispatch = useDispatch();
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

        // Get initial mattertags
        const tags = await mpSdk.Mattertag.getData();
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

        // Subscribe to tag state changes
        mpSdk.Tag.openTags.subscribe({
          prevState: {
            hovered: null,
            docked: null,
            selected: null,
          },
          onChanged(newState: any) {
            // Handle tag selection
            const [selected = null] = newState.selected;
            if (selected !== this.prevState.selected) {
              if (selected) {
                const tag = tags.find((t: MatterTag) => t.sid === selected);
                if (tag) {
                  dispatch(openMatterTagWindow(tag));
                }
              } else {
                dispatch(closeMatterTagWindow());
              }
            }

            // Store the new state
            this.prevState = {
              ...newState,
              selected,
            };
          },
        });

        // Disable all UI elements and overlays
        await mpSdk.App.registerCss(`
          .overlay-ui,
          .annotation-preview,
          .annotation-preview-down,
          .tag-preview,
          .matterport-ui,
          .matterport-ui *,
          #react-render-root,
          .plugin-ui-overlay,
          .plugin-ui-overlay *,
          .plugin-ui-data,
          .plugin-ui-data *,
          .showcase-ui,
          .showcase-ui *,
          .mattertag-tooltip,
          .mattertag-tooltip *,
          .mattertag-hover,
          .mattertag-hover *,
          .mattertag-preview,
          .mattertag-preview *,
          .mattertag-billboard,
          .mattertag-billboard *,
          .mattertag-label,
          .mattertag-label * { 
            display: none !important; 
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }
        `);

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
      {children}
    </div>
  );
}
