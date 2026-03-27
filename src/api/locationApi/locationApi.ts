import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Types for the location API response
export interface LocationPosition {
  x: number;
  y: number;
  z: number;
}

export interface Location {
  id: string;
  label: string;
  description: string;
  color: string;
  position: LocationPosition;
}

export interface Floor {
  id: string;
}

export interface MatterModelResponse {
  model: {
    locations: Location[];
    floors: Floor[];
  };
}

// New types for location detail API
export interface LocationDetail {
  location_name: string;
  description: string;
  x: number;
  y: number;
  z: number;
  color: string;
  enabled: boolean;
  floorId: string;
}

// New types for all locations API
export interface LocationItem {
  location_id: string;
  created_at: string;
  location_name: string;
  color: string;
  description: string | null;
  x: number;
  y: number;
  z: number;
  keywords: string | null;
  floor_id: number;
  room_id: number;
  floor_name: string;
  room_name: string;
  tasks: Task[];
  taskError: string | null;
}

export interface AllLocationsResponse {
  [key: string]: LocationItem;
}

export interface Task {
  task_id: number;
  title: string;
  description: string;
  status: string;
  due_at: string | null;
  priority: number;
  task_type: string | null;
  location: {
    location_id: string;
    created_at: string;
    location_name: string;
    color: string;
    description: string;
    x: number;
    y: number;
    z: number;
    keywords: string;
  };
  created_at: string;
  updated_at: string;
}

export interface LocationDetailResponse {
  location_id: string;
  created_at: string;
  location_name: string;
  color: string;
  description: string | null;
  x: number;
  y: number;
  z: number;
  keywords: string | null;
  floor_id: number;
  room_id: number;
  floor_name: string;
  room_name: string;
  tasks: Task[];
  taskError: string | null;
}

// New types for floors and rooms
export interface FloorData {
  floor_id: number;
  created_at: string;
  name: string;
  matterport_floor_id: string | null;
  sequence: number | null;
}

export interface FloorResponse {
  data: FloorData[];
}

export interface RoomData {
  room_id: number;
  created_at: string;
  name: string;
  description: string | null;
  floor_id: number;
}

export interface RoomResponse {
  data: RoomData[];
}

// Create the API slice
export const locationApi = createApi({
  reducerPath: 'locationApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${import.meta.env.VITE_API_BASE_URL}`,
    prepareHeaders: headers => {
      const token = localStorage.getItem('access_token');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Locations'],
  endpoints: builder => ({
    synchronizeModel: builder.mutation<void, void>({
      query: () => ({
        url: '/synhronize-model',
        method: 'GET',
      }),
    }),

    getAllLocations: builder.query<LocationItem[], void>({
      query: () => ({
        url: '/locations',
        method: 'GET',
      }),
      providesTags: [{ type: 'Locations' }],
    }),

    getLocations: builder.query<MatterModelResponse, void>({
      query: () => ({
        url: '/matter-model',
        method: 'GET',
      }),
      transformResponse: (response: MatterModelResponse) => {
        // Filter out locations that are rooms (they have color "#03a9f4")
        const filteredLocations = response.model.locations.filter(
          location => location.color !== '#03a9f4'
        );

        return {
          ...response,
          model: {
            ...response.model,
            locations: filteredLocations,
          },
        };
      },
    }),

    getLocationByTagId: builder.query<LocationDetailResponse, string>({
      query: tagId => ({
        url: `/locations/${tagId}`,
        method: 'GET',
      }),
    }),

    getLocationById: builder.query<LocationDetailResponse, string>({
      query: locationId => ({
        url: `/locations/${locationId}`,
        method: 'GET',
      }),
    }),

    getFloors: builder.query<FloorResponse, void>({
      query: () => ({
        url: '/floors',
        method: 'GET',
      }),
    }),

    getRooms: builder.query<RoomResponse, void>({
      query: () => ({
        url: '/rooms',
        method: 'GET',
      }),
    }),

    createLocation: builder.mutation<
      { data: LocationDetailResponse[] | null; error: string | null },
      {
        location_name: string;
        description?: string;
        color?: string;
        x: number;
        y: number;
        z: number;
        floorId?: string;
        spaceId?: number | null;
      }
    >({
      query: body => ({
        url: '/locations',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Locations' }],
    }),
  }),
});

// Export hooks
export const {
  useSynchronizeModelMutation,
  useGetAllLocationsQuery,
  useGetLocationsQuery,
  useGetLocationByTagIdQuery,
  useGetLocationByIdQuery,
  useGetFloorsQuery,
  useGetRoomsQuery,
  useCreateLocationMutation,
} = locationApi;
