import { ReactNode, Suspense, lazy, useEffect, useState } from 'react';
import { Box, CircularProgress, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Space } from '../../api/spaces/spacesApi';
import { useSpace } from '../../contexts/SpaceContext';
import Matterport from '../../Layouts/MatterportLayout/components/Matterport';
// The splat renderer is large; only spaces that are shown as a splat ever download it.
const SplatBackground = lazy(() =>
  import('./SplatBackground').then(module => ({ default: module.SplatBackground }))
);

type Viewer = 'matterport' | 'splat';

const storageKey = (spaceId: number) => `cosmic_viewer_${spaceId}`;

export const hasSplat = (space: Space | null): boolean =>
  space?.latest_job?.status === 'completed' &&
  Boolean(space.latest_job.output_spz_path || space.latest_job.output_splat_path);

const readChoice = (spaceId: number): Viewer | null => {
  try {
    const value = localStorage.getItem(storageKey(spaceId));
    return value === 'matterport' || value === 'splat' ? value : null;
  } catch {
    return null;
  }
};

/**
 * Chooses the 3D background per space: Matterport (as before), the space's splat scene, or both
 * with a switch. Spaces without a splat behave exactly as they did.
 */
export function ViewerSwitch({ children }: { children?: ReactNode }) {
  const { activeSpace } = useSpace();
  const splat = hasSplat(activeSpace);
  const matterport = Boolean(activeSpace?.matterport_model_id);
  const both = splat && matterport;

  const [choice, setChoice] = useState<Viewer | null>(null);
  useEffect(() => {
    setChoice(activeSpace ? readChoice(activeSpace.space_id) : null);
  }, [activeSpace]);

  let viewer: Viewer = 'matterport';
  if (splat && !matterport) viewer = 'splat';
  else if (both) viewer = choice ?? 'matterport';

  const select = (next: Viewer | null) => {
    if (!next || !activeSpace) return;
    setChoice(next);
    try {
      localStorage.setItem(storageKey(activeSpace.space_id), next);
    } catch {
      // the choice just is not remembered
    }
  };

  return (
    <>
      {viewer === 'splat' && activeSpace ? (
        <Suspense
          fallback={
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0a0a0a',
              }}
            >
              <CircularProgress sx={{ color: '#fff' }} />
            </Box>
          }
        >
          <SplatBackground key={activeSpace.space_id} space={activeSpace}>
            {children}
          </SplatBackground>
        </Suspense>
      ) : (
        <Matterport>{children}</Matterport>
      )}
      {both && (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={viewer}
          onChange={(_, next: Viewer | null) => select(next)}
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 60,
            backgroundColor: 'rgba(46, 46, 46, 0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: '20px',
            '& .MuiToggleButton-root': {
              color: 'rgba(255,255,255,0.7)',
              border: 'none',
              borderRadius: '20px',
              px: 2,
              textTransform: 'none',
              '&.Mui-selected': { color: '#fff', backgroundColor: 'rgba(255,255,255,0.2)' },
            },
          }}
        >
          <ToggleButton value="matterport">Matterport</ToggleButton>
          <ToggleButton value="splat">Splat</ToggleButton>
        </ToggleButtonGroup>
      )}
    </>
  );
}
