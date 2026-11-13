import type { SpaceRoom, SpaceRooms } from '../../api/spaces/spacesApi';

// Kept free of three.js imports: ViewerSwitch uses this to choose the viewer before the splat
// renderer chunk is downloaded.

/** A room the viewer can show: it has a completed capture with a splat. */
export const isViewableRoom = (room: SpaceRoom): boolean =>
  room.status === 'completed' && Boolean(room.splat_url);

/** True when the space is shown room by room instead of as one splat. */
export const hasViewableRooms = (data: SpaceRooms | null | undefined): boolean =>
  Boolean(data?.rooms?.some(isViewableRoom));
