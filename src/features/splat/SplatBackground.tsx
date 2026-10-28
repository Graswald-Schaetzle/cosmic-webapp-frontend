import { ReactNode, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Space } from '../../api/spaces/spacesApi';
import { useGetJobOutputQuery } from '../../api/reconstruction/reconstructionApi';
import { useMatterport } from '../../contexts/MatterportContext';
import { RootState } from '../../store/store';
import { openMatterTagWindow, openNewLocationWindow } from '../../store/modalSlice';
import { SplatScene } from './SplatScene';
import { SplatSettings } from './SplatSettings';
import { SplatQuality, readFlipped, readQuality, writeFlipped, writeQuality } from './splatQuality';
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
  const [flipped, setFlipped] = useState(() => readFlipped(space.space_id));
  const [quality, setQuality] = useState<SplatQuality>(() => readQuality(space.space_id));
  const tags = useSelector((state: RootState) => state.locations.locations);
  const splatUrl = output?.spz_url ?? output?.splat_url ?? output?.ply_url ?? null;
  const streamUrl = output?.rad_url ?? null;

  // The menu waits for the Matterport viewer to finish loading; there is none in this mode.
  useEffect(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  return (
    <div className="relative w-full h-full" style={{ background: '#0a0a0a' }}>
      <div className="absolute inset-0">
        {splatUrl || streamUrl ? (
          <SplatScene
            key={`${splatUrl}|${streamUrl}`}
            splatUrl={splatUrl}
            streamUrl={streamUrl}
            quality={quality}
            flipped={flipped}
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
      {(splatUrl || streamUrl) && (
        <SplatSettings
          flipped={flipped}
          onFlippedChange={next => {
            setFlipped(next);
            writeFlipped(space.space_id, next);
          }}
          quality={quality}
          onQualityChange={next => {
            setQuality(next);
            writeQuality(space.space_id, next);
          }}
        />
      )}
      {children}
    </div>
  );
}
