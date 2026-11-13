import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as THREE from 'three';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import {
  Space,
  useGetSpaceRoomsQuery,
  useSetSpaceStartRoomMutation,
} from '../../api/spaces/spacesApi';
import { locationApi } from '../../api/locationApi/locationApi';
import {
  useGetJobOutputQuery,
  useSetSpaceFrameMutation,
} from '../../api/reconstruction/reconstructionApi';
import { useMatterport } from '../../contexts/MatterportContext';
import { RootState } from '../../store/store';
import { openMatterTagWindow, openNewLocationWindow } from '../../store/modalSlice';
import { CalibrationPanel, CalibrationStep } from './CalibrationPanel';
import { chooseStartRoom, hasViewableRooms } from './roomLayout';
import { SplatScene } from './SplatScene';
import { SplatPlacement, resolvePlacement } from './spaceFrame';
import { locationToTagPayload } from './tagPayload';

/** While a room of the space is still being processed, the rooms are asked for again this often. */
const ROOMS_POLL_MS = 30000;

interface SplatBackgroundProps {
  space: Space;
  children?: ReactNode;
}

/** The space's splat scene as the app background, with the menu and windows layered on top. */
export function SplatBackground({ space, children }: SplatBackgroundProps) {
  const dispatch = useDispatch();
  const { setIsLoading } = useMatterport();
  // Multi-room spaces: one splat per room (see cosmic-backend/docs/multi-room-spaces.md). The
  // scene is only started once this has answered, so a multi-room space never starts as a
  // single splat first. If the request fails (e.g. a backend without the endpoint), or the
  // space has no room with a finished splat (`rooms: []`), the single-splat path below is used
  // exactly as before.
  const [processingRooms, setProcessingRooms] = useState(false);
  const { data: rooms, isLoading: roomsLoading } = useGetSpaceRoomsQuery(space.space_id, {
    pollingInterval: processingRooms ? ROOMS_POLL_MS : 0,
  });
  const hasProcessingRooms = Boolean(rooms?.rooms?.some(room => room.status === 'processing'));
  useEffect(() => setProcessingRooms(hasProcessingRooms), [hasProcessingRooms]);
  const multiRoom = hasViewableRooms(rooms);
  const [setSpaceStartRoom] = useSetSpaceStartRoomMutation();
  const setStartRoom = useCallback(
    async (roomId: number | null) => {
      try {
        await setSpaceStartRoom({ spaceId: space.space_id, roomId }).unwrap();
      } catch (err) {
        const message = (err as { data?: { error?: string } })?.data?.error;
        throw new Error(message ?? 'Speichern fehlgeschlagen');
      }
    },
    [setSpaceStartRoom, space.space_id]
  );

  // The space frame and view come with a job's output. A multi-room space asks with the capture
  // of its start room: `latest_job` may be a capture that is still being processed.
  const startRoomJobId = useMemo(() => {
    const startRoomId = chooseStartRoom(rooms);
    return rooms?.rooms.find(room => room.room_id === startRoomId)?.job_id ?? null;
  }, [rooms]);
  const jobId = multiRoom ? startRoomJobId : (space.latest_job?.job_id ?? null);
  const {
    data: output,
    isLoading: outputLoading,
    isError,
  } = useGetJobOutputQuery(jobId!, {
    skip: jobId === null,
  });
  const isLoading = roomsLoading || outputLoading;
  const tags = useSelector((state: RootState) => state.locations.locations);
  const singleSplatUrl = output?.spz_url ?? output?.splat_url ?? output?.ply_url ?? null;
  // A multi-room scene starts once the space frame is known (or cannot be had): the rooms are
  // placed with it. Any job of the space reports the same frame.
  const multiRoomReady = multiRoom && (jobId === null || output !== undefined || isError);
  // The single-splat scene waits for the rooms request, which runs alongside the output request.
  const splatUrl = multiRoom || roomsLoading ? null : singleSplatUrl;

  const [setSpaceFrame] = useSetSpaceFrameMutation();
  const [calibrating, setCalibrating] = useState(false);
  const [step, setStep] = useState<CalibrationStep>('floor');
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const placement = useMemo(
    () => resolvePlacement(output?.space_frame, output?.splat_view),
    [output?.space_frame, output?.splat_view]
  );

  // Imports calibrate themselves from the collision mesh. The button stays for spaces without a
  // frame, and anyone can open it with ?calibrate to correct a space by hand.
  const calibrationAvailable = useMemo(
    () => !output?.space_frame || new URLSearchParams(window.location.search).has('calibrate'),
    [output?.space_frame]
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
        {multiRoomReady && rooms ? (
          <SplatScene
            key="rooms"
            rooms={rooms}
            onSetStartRoom={setStartRoom}
            view={output?.splat_view}
            frame={output?.space_frame}
            tags={tags}
            onTagClick={location => dispatch(openMatterTagWindow(locationToTagPayload(location)))}
            onPlaceTag={position => dispatch(openNewLocationWindow({ position, floorId: '' }))}
          />
        ) : splatUrl ? (
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
            {isLoading || multiRoom ? (
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
      {/* Calibrating needs the space's collision mesh; room captures have none yet. */}
      {!multiRoom &&
        output?.collision_url &&
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
          calibrationAvailable && (
            <Button
              className="cosmic-hud"
              data-keep-look
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
          )
        ))}
      {children}
    </div>
  );
}
