import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

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

export const spacesApi = createApi({
  reducerPath: 'spacesApi',
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
  tagTypes: ['Spaces', 'ActiveSpace'],
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
  }),
});

export const { useGetMySpacesQuery, useGetActiveSpaceQuery, useSetActiveSpaceMutation } =
  spacesApi;
