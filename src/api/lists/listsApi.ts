import { api } from '../../app/api';

// List types
export interface ListTask {
  task_id: number;
  created_at: string;
  title: string;
  description: string;
  status: string;
  due_at: string | null;
  priority: string | null;
  created_by_user_id: number | null;
  task_type: string | null;
  location_id: string;
  assignee: {
    user_id: number;
    username: string;
    first_name: string;
    last_name: string;
  } | null;
  documents: Array<{
    document_id: number;
    created_at: string;
    name: string;
    task_id: number;
    storage_path: string | null;
    room_id: number;
    uploaded_by_user_id: number | null;
    location_id: string | null;
  }>;
}

export interface List {
  list_id: number;
  created_at: string;
  name: string;
  tasks: ListTask[];
}

export interface ListResponse {
  list: List;
}

export interface ListsResponse {
  data: List[];
}

export interface CreateListPayload {
  name: string;
  task_ids?: number[];
}

export interface UpdateListPayload {
  name: string;
  task_ids?: number[];
}

// RTK Query endpoints
export const listsApi = api.injectEndpoints({
  endpoints: builder => ({
    getLists: builder.query<ListsResponse, { space_id?: number } | void>({
      query: (params) => ({
        url: '/lists',
        method: 'GET',
        params: params && 'space_id' in params ? { space_id: params.space_id } : {},
      }),
      providesTags: ['Lists'],
    }),

    getListById: builder.query<ListResponse, number>({
      query: id => ({
        url: `/lists/${id}`,
        method: 'GET',
      }),
      providesTags: ['Lists'],
    }),

    createList: builder.mutation<ListResponse, CreateListPayload>({
      query: payload => ({
        url: '/lists',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['Lists'],
    }),

    updateList: builder.mutation<ListResponse, { id: number; payload: UpdateListPayload }>({
      query: ({ id, payload }) => ({
        url: `/lists/${id}`,
        method: 'PUT',
        body: payload,
      }),
      invalidatesTags: ['Lists'],
    }),

    deleteList: builder.mutation<void, number>({
      query: id => ({
        url: `/lists/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Lists'],
    }),
  }),
});

export const {
  useGetListsQuery,
  useGetListByIdQuery,
  useCreateListMutation,
  useUpdateListMutation,
  useDeleteListMutation,
} = listsApi;
