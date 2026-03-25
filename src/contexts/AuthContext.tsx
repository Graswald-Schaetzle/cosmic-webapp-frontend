import { createContext, useContext, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { authorizeUser } from '../app/api';
import { useGetAllLocationsQuery } from '../api/locationApi/locationApi';
import {
  setLocations,
  setLocationsLoading,
  setLocationsError,
  clearLocations,
} from '../store/locationsSlice';
import { setCurrentUser, clearCurrentUser } from '../store/userSlice';

interface CurrentUser {
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
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  currentUser: CurrentUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: false,
  error: null,
  currentUser: null,
  login: async (_email: string, _password: string) => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const dispatch = useDispatch();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUserState] = useState<CurrentUser | null>(null);

  // Fetch locations after authentication
  const {
    data: locationsData,
    isLoading: locationsLoading,
    error: locationsError,
  } = useGetAllLocationsQuery(undefined, {
    skip: !isAuthenticated,
  });

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('current_user');
    if (token && storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUserState(user);
        dispatch(setCurrentUser(user));
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('current_user');
      }
    }
    setIsLoading(false);
  }, [dispatch]);

  // Update locations state when data is fetched
  useEffect(() => {
    if (locationsLoading) {
      dispatch(setLocationsLoading(true));
    } else if (locationsError) {
      dispatch(setLocationsError('Failed to load locations'));
    } else if (locationsData) {
      dispatch(setLocations(locationsData));
    }
  }, [locationsData, locationsLoading, locationsError, dispatch]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const userData = await authorizeUser({ email, password });
      localStorage.setItem('access_token', userData.access_token);
      localStorage.setItem('current_user', JSON.stringify(userData));
      setCurrentUserState(userData);
      dispatch(setCurrentUser(userData));
      setIsAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_user');
    setIsAuthenticated(false);
    setCurrentUserState(null);
    dispatch(clearCurrentUser());
    dispatch(clearLocations());
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading: isLoading || (isAuthenticated && locationsLoading),
        error,
        currentUser,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
