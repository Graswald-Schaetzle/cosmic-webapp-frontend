import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Types for reconstruction jobs
export type ReconstructionStatus =
  | 'pending'
  | 'uploading'
  | 'queued'
  | 'extracting_frames'
  | 'running_colmap'
  | 'training_splat'
  | 'exporting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ReconstructionJob {
  job_id: number;
  space_id: number;
  floor_id: number | null;
  created_by_user_id: number | null;
  title: string;
  status: ReconstructionStatus;
  input_type: 'video' | 'images';
  input_storage_path: string;
  input_frame_count: number | null;
  colmap_point_count: number | null;
  training_iterations: number;
  gcp_batch_job_id: string | null;
  worker_started_at: string | null;
  worker_finished_at: string | null;
  error_message: string | null;
  output_ply_path: string | null;
  output_splat_path: string | null;
  output_spz_path: string | null;
  colmap_sparse_path: string | null;
  point_count: number | null;
  created_at: string;
  updated_at: string;
  upload_url?: string; // Only present on creation
}

export interface CreateJobRequest {
  space_id: number;
  floor_id?: number;
  title: string;
  input_type?: 'video' | 'images';
}

export interface JobOutputResponse {
  job_id: number;
  ply_url?: string;
  splat_url?: string;
  spz_url?: string;
}

// Helper to get a human-readable status label
export function getStatusLabel(status: ReconstructionStatus): string {
  const labels: Record<ReconstructionStatus, string> = {
    pending: 'Ausstehend',
    uploading: 'Wird hochgeladen',
    queued: 'In Warteschlange',
    extracting_frames: 'Frames extrahieren',
    running_colmap: 'COLMAP läuft',
    training_splat: 'Splat-Training',
    exporting: 'Export',
    completed: 'Fertig',
    failed: 'Fehlgeschlagen',
    cancelled: 'Abgebrochen',
  };
  return labels[status] || status;
}

// Helper to check if status is a processing state
export function isProcessing(status: ReconstructionStatus): boolean {
  return ['queued', 'extracting_frames', 'running_colmap', 'training_splat', 'exporting'].includes(
    status
  );
}

// Helper to get progress percentage (approximate)
export function getProgressPercent(status: ReconstructionStatus): number {
  const progress: Record<ReconstructionStatus, number> = {
    pending: 0,
    uploading: 5,
    queued: 10,
    extracting_frames: 20,
    running_colmap: 40,
    training_splat: 70,
    exporting: 90,
    completed: 100,
    failed: 0,
    cancelled: 0,
  };
  return progress[status] || 0;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://cosmic-backend-701520654148.europe-west4.run.app'
).trim();

export const reconstructionApi = createApi({
  reducerPath: 'reconstructionApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: headers => {
      const token = localStorage.getItem('access_token');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['ReconstructionJobs'],
  endpoints: builder => ({
    // Create a new reconstruction job (returns upload URL)
    createJob: builder.mutation<{ data: ReconstructionJob }, CreateJobRequest>({
      query: body => ({
        url: '/reconstruction-jobs',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ReconstructionJobs'],
    }),

    // Confirm upload and start processing
    startJob: builder.mutation<{ data: ReconstructionJob }, number>({
      query: jobId => ({
        url: `/reconstruction-jobs/${jobId}/start`,
        method: 'POST',
      }),
      invalidatesTags: ['ReconstructionJobs'],
    }),

    // Get job status
    getJob: builder.query<ReconstructionJob, number>({
      query: jobId => ({
        url: `/reconstruction-jobs/${jobId}`,
        method: 'GET',
      }),
      transformResponse: (response: { data: ReconstructionJob }) => response.data,
      providesTags: (_result, _error, jobId) => [{ type: 'ReconstructionJobs', id: jobId }],
    }),

    // List jobs for a space
    listJobs: builder.query<ReconstructionJob[], number | undefined>({
      query: spaceId => ({
        url: '/reconstruction-jobs',
        method: 'GET',
        params: spaceId ? { space_id: spaceId } : undefined,
      }),
      transformResponse: (response: { data: ReconstructionJob[] }) => response.data,
      providesTags: ['ReconstructionJobs'],
    }),

    // Get output download URLs
    getJobOutput: builder.query<JobOutputResponse, number>({
      query: jobId => ({
        url: `/reconstruction-jobs/${jobId}/output`,
        method: 'GET',
      }),
      transformResponse: (response: { data: JobOutputResponse }) => response.data,
    }),

    // Cancel a job
    cancelJob: builder.mutation<{ data: ReconstructionJob }, number>({
      query: jobId => ({
        url: `/reconstruction-jobs/${jobId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ReconstructionJobs'],
    }),
  }),
});

export const {
  useCreateJobMutation,
  useStartJobMutation,
  useGetJobQuery,
  useListJobsQuery,
  useGetJobOutputQuery,
  useCancelJobMutation,
} = reconstructionApi;
