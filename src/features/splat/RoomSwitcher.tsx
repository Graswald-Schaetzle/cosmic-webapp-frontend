import { useMemo, useState } from 'react';
import { Box, ButtonBase, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import type { SpaceRoom, SpaceRooms } from '../../api/spaces/spacesApi';
import type { MultiRoomStatus } from './multiRoomController';
import { chooseStartRoom, groupRoomsByFloor, isPlacedRoom, isViewableRoom } from './roomLayout';

const FONT =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const ROOM_COLOR = '#FFA600';

interface RoomSwitcherProps {
  data: SpaceRooms;
  status: MultiRoomStatus | null;
  /** Jumps into a room: loads it and puts the camera inside. */
  onJump: (roomId: number) => void;
  /** Sets the space's start room; null goes back to the automatic one. Rejects on failure. */
  onSetStartRoom?: (roomId: number | null) => Promise<unknown>;
}

const chipSx = (color: string) => ({
  flexShrink: 0,
  px: 1,
  py: '2px',
  borderRadius: '100px',
  fontSize: 11,
  fontWeight: 600,
  lineHeight: '16px',
  color,
  backgroundColor: `${color}40`,
});

/** What keeps a room from being entered, or says something about it; null for a plain room. */
function roomNote(room: SpaceRoom, failed: boolean): { text: string; color: string } | null {
  if (room.status === 'processing') return { text: 'Wird verarbeitet', color: '#FF9500' };
  if (room.status === 'failed') return { text: 'Fehlgeschlagen', color: '#FF3B30' };
  if (!isViewableRoom(room)) return { text: 'Nicht verfügbar', color: '#FF3B30' };
  if (failed) return { text: 'Laden fehlgeschlagen', color: '#FF3B30' };
  if (!isPlacedRoom(room)) return { text: 'Nicht ausgerichtet', color: '#FFFFFF' };
  return null;
}

/**
 * The rooms of a multi-room space, grouped by floor, in the viewer's glass HUD: tap a room to
 * jump into it, mark one as the room the space starts in. Rooms that are still being processed
 * or have failed are listed but cannot be entered. A room that is "nicht ausgerichtet" has no
 * frame; it is shown on its own while the user is in it.
 */
export function RoomSwitcher({ data, status, onJump, onSetStartRoom }: RoomSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const groups = useMemo(() => groupRoomsByFloor(data.rooms), [data.rooms]);
  const startRoomId = useMemo(() => chooseStartRoom(data), [data]);
  const currentRoom = data.rooms.find(room => room.room_id === status?.currentRoomId);

  const setStartRoom = async (roomId: number | null) => {
    if (!onSetStartRoom || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSetStartRoom(roomId);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      className="cosmic-hud"
      data-keep-look
      data-testid="room-switcher"
      sx={{
        position: 'absolute',
        right: 16,
        bottom: 'max(24px, env(safe-area-inset-bottom))',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 1,
        fontFamily: FONT,
      }}
    >
      {open && (
        <Box
          role="dialog"
          aria-label="Räume"
          sx={{
            width: 'min(320px, calc(100vw - 32px))',
            maxHeight: 'min(60vh, 520px)',
            display: 'flex',
            flexDirection: 'column',
            padding: '12px',
            borderRadius: '24px',
            backgroundColor: 'rgba(46, 46, 46, 0.85)',
            backdropFilter: 'blur(100px)',
            WebkitBackdropFilter: 'blur(100px)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 32,
              pl: 1,
              mb: 1,
            }}
          >
            <Typography sx={{ color: '#FFFFFF', fontSize: 16, fontWeight: 700, fontFamily: FONT }}>
              Räume
            </Typography>
            <IconButton
              size="small"
              aria-label="Raumliste schließen"
              onClick={() => setOpen(false)}
              sx={{
                width: 32,
                height: 32,
                color: '#FFFFFF',
                backgroundColor: '#00000033',
                '&:hover': { backgroundColor: '#FFFFFF1A' },
              }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>

          <Box sx={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {groups.map(group => (
              <Box key={group.floorId ?? 'none'} sx={{ mb: 1 }}>
                <Typography
                  sx={{
                    px: 1,
                    pb: 0.5,
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    fontFamily: FONT,
                  }}
                >
                  {group.name ?? 'Ohne Stockwerk'}
                </Typography>
                {group.rooms.map(room => {
                  const viewable = isViewableRoom(room);
                  const isCurrent = room.room_id === status?.currentRoomId;
                  const isLoading = Boolean(status?.loadingRoomIds.includes(room.room_id));
                  const note = roomNote(
                    room,
                    Boolean(status?.failedRoomIds.includes(room.room_id))
                  );
                  const isStart = room.room_id === startRoomId;
                  const isChosenStart = room.room_id === data.start_room_id;
                  return (
                    <Box
                      key={room.room_id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '16px',
                        backgroundColor: isCurrent ? 'rgba(255,255,255,0.15)' : 'transparent',
                        '&:hover': viewable ? { backgroundColor: 'rgba(255,255,255,0.15)' } : {},
                      }}
                    >
                      <ButtonBase
                        disabled={!viewable}
                        aria-current={isCurrent ? 'true' : undefined}
                        onClick={() => {
                          onJump(room.room_id);
                          setOpen(false);
                        }}
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          minHeight: 44,
                          px: 1,
                          gap: 1,
                          justifyContent: 'flex-start',
                          borderRadius: '16px',
                          fontFamily: FONT,
                        }}
                      >
                        <Typography
                          noWrap
                          sx={{
                            color: viewable ? '#FFFFFF' : 'rgba(255,255,255,0.3)',
                            fontSize: 14,
                            fontWeight: isCurrent ? 600 : 400,
                            fontFamily: FONT,
                          }}
                        >
                          {room.name}
                        </Typography>
                        {isStart && <Box sx={chipSx(ROOM_COLOR)}>Start</Box>}
                        {note && <Box sx={chipSx(note.color)}>{note.text}</Box>}
                        {isLoading && (
                          <CircularProgress size={14} sx={{ color: '#FFFFFF', flexShrink: 0 }} />
                        )}
                      </ButtonBase>
                      {onSetStartRoom && viewable && (
                        <Tooltip
                          title={isChosenStart ? 'Ist der Startraum' : 'Als Startraum festlegen'}
                        >
                          <span>
                            <IconButton
                              aria-label={
                                isChosenStart
                                  ? `${room.name} ist der Startraum`
                                  : `${room.name} als Startraum festlegen`
                              }
                              aria-pressed={isChosenStart}
                              disabled={saving || isChosenStart}
                              onClick={() => setStartRoom(room.room_id)}
                              sx={{
                                width: 44,
                                height: 44,
                                color: isChosenStart ? ROOM_COLOR : 'rgba(255,255,255,0.7)',
                                '&.Mui-disabled': {
                                  color: isChosenStart ? ROOM_COLOR : 'rgba(255,255,255,0.3)',
                                },
                              }}
                            >
                              {isChosenStart ? (
                                <StarIcon sx={{ fontSize: 20 }} />
                              ) : (
                                <StarBorderIcon sx={{ fontSize: 20 }} />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>

          {onSetStartRoom && (
            <Box sx={{ pt: 1, px: 1 }}>
              {data.start_room_id != null ? (
                <ButtonBase
                  disabled={saving}
                  onClick={() => setStartRoom(null)}
                  sx={{
                    minHeight: 36,
                    px: 1.5,
                    borderRadius: '20px',
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: FONT,
                    backgroundColor: 'rgba(0,0,0,0.15)',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.15)' },
                    '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' },
                  }}
                >
                  Startraum automatisch wählen
                </ButtonBase>
              ) : (
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: FONT }}>
                  Startraum: automatisch (Raum der ersten Aufnahme). Mit dem Stern legst du einen
                  anderen fest.
                </Typography>
              )}
              {saveError && (
                <Typography sx={{ mt: 0.5, color: '#FF6B6B', fontSize: 12, fontFamily: FONT }}>
                  {saveError}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )}

      <ButtonBase
        aria-label="Räume anzeigen"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        sx={{
          maxWidth: 'min(240px, calc(100vw - 32px))',
          minHeight: 44,
          px: 2,
          gap: 1,
          borderRadius: '100px',
          color: '#FFFFFF',
          fontSize: 14,
          fontWeight: 600,
          fontFamily: FONT,
          backgroundColor: 'rgba(46, 46, 46, 0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          '&:hover': { backgroundColor: 'rgba(46, 46, 46, 0.85)' },
        }}
      >
        <MeetingRoomOutlinedIcon sx={{ fontSize: 20 }} />
        <Box
          component="span"
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {currentRoom?.name ?? 'Räume'}
        </Box>
      </ButtonBase>
    </Box>
  );
}
