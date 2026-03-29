import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { AxiosRequestConfig } from 'axios';
import axiosInstance from './axios';

interface AuthResponse {
  user: {
    user_id: number;
    created_at: string;
    username: string;
    email: string;
    supabase_id: string;
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

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://haaaayxcejprzqjainzp.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhYWFheXhjZWpwcnpxamFpbnpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDE0NzIsImV4cCI6MjA3MDQ3NzQ3Mn0.5ehbB4SCgeiDIBNtXBESOeAXsPuG5wBvmvfp_MiuHhc';

interface UserInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

async function supabaseSignIn(email: string, password: string): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error('E-Mail oder Passwort ist falsch.');
  }

  const data = await response.json();
  return data.user.id as string;
}

async function supabaseSignUp(
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      email,
      password,
      data: { first_name: firstName, last_name: lastName },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Registrierung fehlgeschlagen.');
  }

  const data = await response.json();
  if (!data.user?.id) {
    throw new Error('Registrierung fehlgeschlagen. Bitte überprüfe deine E-Mail-Adresse.');
  }
  return data.user.id as string;
}

export async function registerUser(userInput: UserInput): Promise<AuthResponse['user']> {
  const supabaseUserId = await supabaseSignUp(
    userInput.email,
    userInput.password,
    userInput.firstName!,
    userInput.lastName!
  );

  try {
    const response = await axiosInstance({
      url: '/auth/login',
      method: 'POST',
      data: {
        supabase_id: supabaseUserId,
        first_name: userInput.firstName,
        last_name: userInput.lastName,
      },
    });

    const data: AuthResponse = response.data;
    if (!data.user?.access_token) {
      throw new Error('Failed to get access token');
    }

    return data.user;
  } catch (error: any) {
    console.error('Registration error:', error);
    throw new Error(
      error.response?.data?.message || error.message || 'Registrierung fehlgeschlagen'
    );
  }
}

export async function authorizeUser(userInput: UserInput): Promise<AuthResponse['user']> {
  const supabaseUserId = await supabaseSignIn(userInput.email, userInput.password);

  try {
    const response = await axiosInstance({
      url: '/auth/login',
      method: 'POST',
      data: { supabase_id: supabaseUserId },
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
