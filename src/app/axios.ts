import axios from 'axios';
import { getValidAccessToken } from './authToken';

const API_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://cosmic-backend-701520654148.europe-west4.run.app'
).trim();

const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // Disable credentials for CORS
});

// Request interceptor
axiosInstance.interceptors.request.use(
  async config => {
    // Add auth token if available (renewed first when expired)
    const token = await getValidAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add any other request modifications here
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    // Handle common errors here
    if (error.response?.status === 401) {
      // Handle unauthorized
      localStorage.removeItem('access_token');
      // Redirect to login or refresh token
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
