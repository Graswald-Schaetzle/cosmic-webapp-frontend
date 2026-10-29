import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as THREE from 'three';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { Space } from '../../api/spaces/spacesApi';
import { locationApi } from '../../api/locationApi/locationApi';
import {
  useGetJobOutputQuery,
  useSetSpaceFrameMutation,
} from '../../api/reconstruction/reconstructionApi';
import { useMatterport } from '../../contexts/MatterportContext';
import { RootState } from '../../store/store';
import { openMatterTagWindow, openNewLocationWindow } from '../../store/modalSlice';
import { CalibrationPanel, CalibrationStep } from './CalibrationPanel';
import { SplatScene } from './SplatScene';
import { SplatPlacement, resolvePlacement } from './spaceFrame';
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

  const [setSpaceFrame] = useSetSpaceFrameMutation();
  const [calibrating, setCalibrating] = useState(false);
  const [step, setStep] = useState<CalibrationStep>('floor');
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const placement = useMemo(
    () => resolvePlacement(output?.space_frame, output?.splat_view),
    [output?.space_frame, output?.splat_view]
  );

  const calibration = useMemo(
    () =>
      calibrating
        ? { points, onPick: (point: THREE.Vector3) => setPoints(p => [...p, point]) }
        : null,
    [calibrating, points]
  );

  const applyPlacement = useCallback(
    async (next: SplatPlacement) => {
      try {
        await setSpaceFrame({
          spaceId: space.space_id,
          splat: next,
          expectedVersion: output?.space_frame?.version ?? 0,
        }).unwrap();
      } catch (err) {
        const message = (err as { data?: { error?: string } })?.data?.error;
        throw new Error(message ?? 'Speichern fehlgeschlagen');
      }
      // The backend moved the space's tags with the model; load them again.
      dispatch(locationApi.util.invalidateTags([{ type: 'Locations' }]));
    },
    [dispatch, output?.space_frame?.version, setSpaceFrame, space.space_id]
  );

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
            view={output?.splat_view}
            frame={output?.space_frame}
            minimap={output?.minimap}
            calibration={calibration}
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
      {output?.collision_url &&
        (calibrating ? (
          <CalibrationPanel
            placement={placement}
            points={points}
            step={step}
            onStepChange={next => {
              setStep(next);
              setPoints([]);
            }}
            onClearPoints={() => setPoints([])}
            onApply={applyPlacement}
            onClose={() => {
              setCalibrating(false);
              setPoints([]);
            }}
          />
        ) : (
          <Button
            size="small"
            onClick={() => setCalibrating(true)}
            sx={{
              position: 'absolute',
              right: 16,
              bottom: 24,
              zIndex: 20,
              px: 2,
              textTransform: 'none',
              color: 'rgba(255,255,255,0.85)',
              backgroundColor: 'rgba(46, 46, 46, 0.6)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderRadius: '20px',
            }}
          >
            Kalibrieren
          </Button>
        ))}
      {children}
    </div>
  );
}
