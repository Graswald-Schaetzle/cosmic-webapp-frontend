import { api } from '../../app/api';

// User types
export interface User {
  user_id: number;
  created_at: string;
  username: string;
  email: string;
  clerk_id: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface UsersResponse {
  users: User[];
}

// User menu item types
export interface UserMenuItem {
  menu_items_id: number;
  created_at: string;
  name: string;
  order: number;
  enabled: boolean;
  user_id: number;
}

export interface UserMenuPayload {
  name: string;
  order: number;
  enabled: boolean;
}

export interface UserMenuResponse {
  data: UserMenuItem[];
  error: string | null;
}

// RTK Query endpoints
export const userMenuApi = api.injectEndpoints({
  endpoints: builder => ({
    getUsers: builder.query<UsersResponse, void>({
      query: () => ({
        url: '/auth/users',
        method: 'GET',
      }),
      providesTags: ['Users'],
    }),

    getUserMenu: builder.query<UserMenuResponse, void>({
      query: () => ({
        url: '/user-menu',
        method: 'GET',
      }),
      providesTags: ['UserMenu'],
    }),

    createUserMenu: builder.mutation<UserMenuResponse, UserMenuPayload[]>({
      query: menuItems => ({
        url: '/user-menu',
        method: 'POST',
        body: menuItems,
      }),
      invalidatesTags: ['UserMenu'],
    }),

    updateUserMenu: builder.mutation<UserMenuResponse, UserMenuPayload[]>({
      query: menuItems => ({
        url: '/user-menu',
        method: 'PUT',
        body: menuItems,
      }),
      invalidatesTags: ['UserMenu'],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserMenuQuery,
  useCreateUserMenuMutation,
  useUpdateUserMenuMutation,
} = userMenuApi;
