import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getValidAccessToken } from '../../app/authToken';

export interface SpaceLatestJob {
  job_id: number;
  space_id: number;
  status: string;
  output_splat_path: string | null;
  output_spz_path: string | null;
  created_at: string;
}

export interface Space {
  space_id: number;
  name: string;
  description: string | null;
  model_url: string | null;
  matterport_model_id: string | null;
  matterport_showcase_url: string | null;
  owner_user_id: number | null;
  created_at: string;
  updated_at: string;
  rooms: { room_id: number; name: string; space_id: number }[];
  locations: unknown[];
  latest_job: SpaceLatestJob | null;
}

/** Where a room frame comes from; see cosmic-backend/docs/multi-room-spaces.md. */
export type RoomFrameSource = 'start' | 'session' | 'doors' | 'manual';

/**
 * Maps a room's capture coordinates into the rooms frame (the capture coordinates of the start
 * room): p_rooms = translation + R(rotation_deg) * (scale * p_capture), Euler XYZ in degrees,
 * the same convention as SplatPlacement. Frames with source `doors` are estimates: whether
 * Echo-3 returns splats in the capture coordinates is not verified yet.
 */
export interface RoomFrame {
  scale: number;
  rotation_deg: [number, number, number];
  translation: [number, number, number];
  source: RoomFrameSource;
}

/** A door threshold in the capture coordinates of one room. */
export interface Door {
  /** Centre of the threshold on the floor. */
  position: [number, number, number];
  /** Horizontal unit vector in the direction of travel, from `from_room` into `to_room`. */
  normal: [number, number, number];
  width_m?: number | null;
}

export type SpaceRoomStatus = 'completed' | 'processing' | 'failed';

/** A room of a space, represented by its newest completed capture (if it has one). */
export interface SpaceRoom {
  room_id: number;
  name: string;
  floor_id: number | null;
  floor_name: string | null;
  floor_sequence: number | null;
  status: SpaceRoomStatus;
  job_id: number | null;
  /** Null unless `status` is `completed`. */
  splat_url: string | null;
  /** Room captures have no collision mesh yet. */
  collision_url: string | null;
  /** Null when the room cannot be placed relative to the start room. */
  room_frame: RoomFrame | null;
  captured_at: string | null;
}

/** A door between two rooms; each door is in the capture coordinates of its own room. */
export interface RoomConnection {
  connection_id: number;
  from_room_id: number;
  to_room_id: number;
  from_door: Door;
  to_door: Door | null;
}

/** `GET /spaces/:id/rooms`: everything the viewer needs to show a multi-room space. */
export interface SpaceRooms {
  space_id: number;
  /** The start room set by the user, or null for the automatic one. */
  start_room_id: number | null;
  /** The room the viewer loads first: `start_room_id` or the room of the earliest capture. */
  effective_start_room_id: number | null;
  /** Empty for spaces without room captures (those use the single-splat path). */
  rooms: SpaceRoom[];
  connections: RoomConnection[];
}

export interface SpaceStartRoom {
  space_id: number;
  start_room_id: number | null;
  effective_start_room_id: number | null;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://cosmic-backend-701520654148.europe-west4.run.app'
).trim();

export const spacesApi = createApi({
  reducerPath: 'spacesApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: async headers => {
      const token = await getValidAccessToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Spaces', 'ActiveSpace', 'DefaultSpace', 'SpaceRooms'],
  endpoints: builder => ({
    getMySpaces: builder.query<Space[], void>({
      query: () => '/spaces',
      transformResponse: (response: { data: Space[] }) => response.data,
      providesTags: ['Spaces'],
    }),
    getActiveSpace: builder.query<number | null, void>({
      query: () => '/auth/user/active-space',
      transformResponse: (response: { active_space_id: number | null }) => response.active_space_id,
      providesTags: ['ActiveSpace'],
    }),
    setActiveSpace: builder.mutation<void, number | null>({
      query: spaceId => ({
        url: '/auth/user/active-space',
        method: 'PUT',
        body: { space_id: spaceId },
      }),
      invalidatesTags: ['ActiveSpace'],
    }),
    getDefaultSpace: builder.query<number | null, void>({
      query: () => '/auth/user/default-space',
      transformResponse: (response: { default_space_id: number | null }) =>
        response.default_space_id,
      providesTags: ['DefaultSpace'],
    }),
    setDefaultSpace: builder.mutation<void, number | null>({
      query: spaceId => ({
        url: '/auth/user/default-space',
        method: 'PUT',
        body: { space_id: spaceId },
      }),
      async onQueryStarted(spaceId, { dispatch, queryFulfilled }) {
        // Optimistic update so the star reacts immediately; roll back on failure
        const patch = dispatch(
          spacesApi.util.updateQueryData('getDefaultSpace', undefined, () => spaceId)
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
    // The rooms of a space with their splats, frames and doors (multi-room spaces).
    getSpaceRooms: builder.query<SpaceRooms, number>({
      query: spaceId => `/spaces/${spaceId}/rooms`,
      transformResponse: (response: { data: SpaceRooms }) => response.data,
      providesTags: (_result, _error, spaceId) => [{ type: 'SpaceRooms', id: spaceId }],
    }),
    // Sets the room the viewer loads first; null goes back to the automatic start room. The
    // backend recomputes every room frame from the new start room, so the rooms are reloaded.
    setSpaceStartRoom: builder.mutation<SpaceStartRoom, { spaceId: number; roomId: number | null }>(
      {
        query: ({ spaceId, roomId }) => ({
          url: `/spaces/${spaceId}/start-room`,
          method: 'PUT',
          body: { room_id: roomId },
        }),
        transformResponse: (response: { data: SpaceStartRoom }) => response.data,
        invalidatesTags: (_result, _error, { spaceId }) => [{ type: 'SpaceRooms', id: spaceId }],
      }
    ),
  }),
});

export const {
  useGetMySpacesQuery,
  useGetActiveSpaceQuery,
  useSetActiveSpaceMutation,
  useGetDefaultSpaceQuery,
  useSetDefaultSpaceMutation,
  useGetSpaceRoomsQuery,
  useSetSpaceStartRoomMutation,
} = spacesApi;
