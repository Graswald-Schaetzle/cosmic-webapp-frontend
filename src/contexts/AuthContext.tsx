import { createContext, useContext, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { authorizeUser, registerUser } from '../app/api';
import { useGetAllLocationsQuery } from '../api/locationApi/locationApi';
import {
  setLocations,
  setLocationsLoading,
  setLocationsError,
  clearLocations,
} from '../store/locationsSlice';
import { setCurrentUser, clearCurrentUser } from '../store/userSlice';
import { RootState } from '../store/store';

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
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: false,
  error: null,
  currentUser: null,
  login: async (_email: string, _password: string) => {},
  register: async () => {},
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
  const activeSpaceId = useSelector((state: RootState) => state.space.activeSpaceId);

  // Fetch locations after authentication, scoped to active space
  const {
    data: locationsData,
    isLoading: locationsLoading,
    error: locationsError,
  } = useGetAllLocationsQuery(
    activeSpaceId ? { space_id: activeSpaceId } : undefined,
    { skip: !isAuthenticated || !activeSpaceId }
  );

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

  // Clear locations when active space changes, then load new ones
  useEffect(() => {
    dispatch(clearLocations());
  }, [activeSpaceId, dispatch]);

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
      localStorage.setItem('cosmic_returning_user', 'true');
      setCurrentUserState(userData);
      dispatch(setCurrentUser(userData));
      setIsAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const userData = await registerUser({ email, password, firstName, lastName });
      localStorage.setItem('access_token', userData.access_token);
      localStorage.setItem('current_user', JSON.stringify(userData));
      localStorage.setItem('cosmic_returning_user', 'true');
      setCurrentUserState(userData);
      dispatch(setCurrentUser(userData));
      setIsAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen');
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
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
