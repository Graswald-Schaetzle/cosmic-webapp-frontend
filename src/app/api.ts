// @ts-ignore
import { User } from '@clerk/clerk-react';
import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { AxiosRequestConfig } from 'axios';
import axiosInstance from './axios';

interface AuthResponse {
  user: {
    user_id: number;
    created_at: string;
    username: string;
    email: string;
    clerk_id: string;
    first_name: string;
    last_name: string;
    role: string;
    access_token: string;
    refresh_token: string;
  };
}

const baseQuery: BaseQueryFn = async (args, { signal }) => {
  try {
    // Create axios config
    const config: AxiosRequestConfig = {
      url: args.url,
      method: args.method,
      signal,
    };

    if (args?.body) {
      if (args.isFormData) {
        const bodyFormData = new FormData();
        Object.entries(args.body).forEach(([key, value]) => {
          if (value instanceof File) {
            bodyFormData.append(key, value);
            return;
          }
          bodyFormData.append(key, `${value}` as string);
        });
        config.data = bodyFormData;
        config.headers = { 'Content-Type': 'multipart/form-data' };
      } else {
        config.data = args.body;
      }
    }

    const response = await axiosInstance(config);
    return { data: response.data };
  } catch (error: any) {
    console.error('BaseQuery error:', error);
    return {
      error: {
        status: error.response?.status,
        data: error.response?.data || error.message,
      },
    };
  }
};

// initialize an empty api service that we'll inject endpoints into later as needed
export const api = createApi({
  baseQuery,
  endpoints: () => ({}),
  tagTypes: ['Tasks', 'Documents', 'Notifications', 'UserMenu', 'Lists', 'Locations', 'Users'],
});

export async function authorizeUser(clerkUser: User): Promise<AuthResponse['user']> {
  const user = {
    first_name: clerkUser.firstName || '',
    last_name: clerkUser.lastName || '',
    email: clerkUser.emailAddresses[0].emailAddress || '',
    clerk_id: clerkUser.id || '',
    role: 'user',
    username: clerkUser.fullName.replace(/\s/g, '') || '',
  };

  try {
    const response = await axiosInstance({
      url: '/auth/login',
      method: 'POST',
      data: user,
    });

    const data: AuthResponse = response.data;
    if (!data.user?.access_token) {
      throw new Error('Failed to get access token');
    }

    // Save token to localStorage
    localStorage.setItem('access_token', data.user.access_token);

    return data.user;
  } catch (error: any) {
    console.error('Authorization error:', error);
    if (error.response?.status === 0 || error.code === 'ERR_NETWORK') {
      throw new Error(
        'Network error: Unable to connect to the server. Please check your internet connection.'
      );
    }
    if (error.response?.status === 403) {
      throw new Error('CORS error: Server is not configured to accept requests from this origin.');
    }
    throw new Error(error.response?.data?.message || error.message || 'Authentication failed');
  }
}
