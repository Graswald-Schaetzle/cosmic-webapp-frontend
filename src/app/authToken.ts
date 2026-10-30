const API_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://cosmic-backend-701520654148.europe-west4.run.app'
).trim();

/** Dispatched on window when the session can no longer be renewed and the user has to log in again. */
export const AUTH_EXPIRED_EVENT = 'cosmic:auth-expired';

// Renew a little early so a request never leaves with a token that expires in flight.
const EXPIRY_SKEW_SECONDS = 30;

const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return (
      typeof payload.exp === 'number' && payload.exp - EXPIRY_SKEW_SECONDS <= Date.now() / 1000
    );
  } catch {
    return false;
  }
};

let refreshing: Promise<string | null> | null = null;

const refreshAccessToken = (): Promise<string | null> => {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('current_user') || 'null');
      const refreshToken: string | undefined = storedUser?.refresh_token;
      if (!refreshToken) throw new Error('No refresh token');

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) throw new Error(`Refresh failed (${response.status})`);

      const { access_token: accessToken } = await response.json();
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem(
        'current_user',
        JSON.stringify({ ...storedUser, access_token: accessToken })
      );
      return accessToken as string;
    } catch {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      return null;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
};

/** Returns the stored access token, renewing it first when it has expired. */
export const getValidAccessToken = async (): Promise<string | null> => {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  if (!isTokenExpired(token)) return token;
  return refreshAccessToken();
};
