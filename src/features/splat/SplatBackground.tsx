import { ReactNode, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Space } from '../../api/spaces/spacesApi';
import { useGetJobOutputQuery } from '../../api/reconstruction/reconstructionApi';
import { useMatterport } from '../../contexts/MatterportContext';
import { RootState } from '../../store/store';
import { openMatterTagWindow, openNewLocationWindow } from '../../store/modalSlice';
import { SplatScene } from './SplatScene';
import { locationToTagPayload } from './tagPayload';

interface SplatBackgroundProps {
  space: Space;
  children?: ReactNode;
}

/** The space's splat scene as the app background, with the menu and windows layered on top. */
export function SplatBackground({ space, children }: SplatBackgroundProps) {
  const dispatch = useDispatch();
  const { setIsLoading } = useMatterport();
  const jobId = space.latest_job?.job_id ?? null;
  const {
    data: output,
    isLoading,
    isError,
  } = useGetJobOutputQuery(jobId!, {
    skip: jobId === null,
  });
  const tags = useSelector((state: RootState) => state.locations.locations);
  const splatUrl = output?.spz_url ?? output?.splat_url ?? output?.ply_url ?? null;

  // The menu waits for the Matterport viewer to finish loading; there is none in this mode.
  useEffect(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  return (
    <div className="relative w-full h-full" style={{ background: '#0a0a0a' }}>
      <div className="absolute inset-0">
        {splatUrl ? (
          <SplatScene
            key={splatUrl}
            splatUrl={splatUrl}
            collisionUrl={output?.collision_url}
            tags={tags}
            onTagClick={location => dispatch(openMatterTagWindow(locationToTagPayload(location)))}
            onPlaceTag={position => dispatch(openNewLocationWindow({ position, floorId: '' }))}
          />
        ) : (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            {isLoading ? (
              <CircularProgress sx={{ color: '#fff' }} />
            ) : (
              <Typography sx={{ color: isError ? '#FF6B6B' : '#aaa', fontSize: 14 }}>
                {isError
                  ? 'Die 3D-Szene konnte nicht geladen werden.'
                  : 'Keine 3D-Szene verfügbar.'}
              </Typography>
            )}
          </Box>
        )}
      </div>
      {children}
    </div>
  );
}
