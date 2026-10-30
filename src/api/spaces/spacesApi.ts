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

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://cosmic-backend-701520654148.europe-west4.run.app'
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
  tagTypes: ['Spaces', 'ActiveSpace', 'DefaultSpace'],
  endpoints: builder => ({
    getMySpaces: builder.query<Space[], void>({
      query: () => '/spaces',
      transformResponse: (response: { data: Space[] }) => response.data,
      providesTags: ['Spaces'],
    }),
    getActiveSpace: builder.query<number | null, void>({
      query: () => '/auth/user/active-space',
      transformResponse: (response: { active_space_id: number | null }) =>
        response.active_space_id,
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
  }),
});

export const {
  useGetMySpacesQuery,
  useGetActiveSpaceQuery,
  useSetActiveSpaceMutation,
  useGetDefaultSpaceQuery,
  useSetDefaultSpaceMutation,
} = spacesApi;
