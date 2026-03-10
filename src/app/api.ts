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

interface UserInput {
  email: string;
  first_name: string;
  last_name: string;
}

export async function authorizeUser(userInput: UserInput): Promise<AuthResponse['user']> {
  const user = {
    first_name: userInput.first_name,
    last_name: userInput.last_name,
    email: userInput.email,
    clerk_id: userInput.email,
    role: 'user',
    username: `${userInput.first_name}${userInput.last_name}`.replace(/\s/g, ''),
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
