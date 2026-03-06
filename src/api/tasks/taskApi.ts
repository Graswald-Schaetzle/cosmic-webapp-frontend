import { api } from '../../app/api';

// Task types
export interface TaskPayload {
  title?: string;
  description?: string;
  status?: string;
  location_id?: string;
  task_type?: string;
  created_by_user_id?: number;
  due_at?: string;
  recurrence_rule?: string;
  lists_ids?: number[];
}

export interface Assignee {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
}

export interface Document {
  document_id: number;
  created_at: string;
  name: string;
  task_id: number;
  storage_path: string | null;
  room_id: number;
  uploaded_by_user_id: number | null;
  location_id: string | null;
}

export interface Location {
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
}

// Updated Task detail interface to match new API response
export interface TaskDetail {
  task_id: number;
  created_at: string;
  title: string;
  description: string;
  status: string;
  due_at: string | null;
  priority: string | null;
  assignee: Assignee;
  task_type: string | null;
  locations: Location;
}

// Task detail for single task response (updated to match actual API response)
export interface TaskDetailSingle {
  task_id: number;
  created_at: string;
  title: string;
  description: string;
  status: string;
  due_at: string | null;
  priority: string | null;
  assignee: Assignee;
  task_type: string | null;
  recurrence_rule: string | null;
  location: Location;
  documents: Document[];
  lists: Array<{
    list_id: number;
    name: string;
  }>;
}

// POST response type - returns single task object
export interface TaskCreateResponse {
  data: {
    task_id: number;
    created_at: string;
    title: string;
    description: string;
    status: string;
    due_at: string | null;
    priority: string | null;
    created_by_user_id: number | null;
    task_type: string | null;
    recurrence_rule: string | null;
    location_id: string;
    lists_id?: number;
  };
}

// PUT response type - returns data array with error field
export interface TaskUpdateResponse {
  data: TaskDetail[];
  error: string | null;
}

// Updated GET tasks list response to match new structure
export interface TaskListResponse {
  data: TaskDetail[];
  errors: {
    taskError: string | null;
    documentsError: string | null;
  };
}

// GET single task response
export interface TaskDetailResponse {
  task: TaskDetailSingle;
  documents: any[];
  errors: {
    taskError: string | null;
    documentsError: string | null;
  };
}

// RTK Query endpoints
export const taskApi = api.injectEndpoints({
  endpoints: builder => ({
    getTasks: builder.query<TaskListResponse, void>({
      query: () => ({
        url: '/task',
        method: 'GET',
      }),
      providesTags: ['Tasks'],
    }),

    getTasksByLocation: builder.query<TaskListResponse, string | undefined>({
      query: locationId => ({
        url: '/task',
        method: 'GET',
        params: locationId ? { location_id: locationId } : {},
      }),
      providesTags: ['Tasks'],
    }),

    getTaskById: builder.query<TaskDetailResponse, number>({
      query: id => ({
        url: `/task/${id}`,
        method: 'GET',
      }),
      providesTags: ['Tasks'],
    }),

    createTask: builder.mutation<TaskCreateResponse, TaskPayload>({
      query: payload => ({
        url: '/task',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['Tasks'],
    }),

    updateTask: builder.mutation<TaskUpdateResponse, { id: number; payload: TaskPayload }>({
      query: ({ id, payload }) => ({
        url: `/task/${id}`,
        method: 'PUT',
        body: payload,
      }),
      invalidatesTags: ['Tasks'],
    }),

    deleteTask: builder.mutation<void, number>({
      query: id => ({
        url: `/task/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Tasks'],
    }),
  }),
});

export const {
  useGetTasksQuery,
  useGetTasksByLocationQuery,
  useGetTaskByIdQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
} = taskApi;
