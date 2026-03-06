import { createContext, useContext, useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
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
  clerk_id: string;
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
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  error: null,
  currentUser: null,
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const { user, isSignedIn, isLoaded } = useUser();
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

  useEffect(() => {
    const handleAuthentication = async () => {
      if (!isLoaded) return;

      if (isSignedIn && user) {
        try {
          setIsLoading(true);
          setError(null);

          // Call our custom signup endpoint with Clerk user data
          const userData = await authorizeUser(user);

          // Check if token was set
          const token = localStorage.getItem('access_token');
          if (!token) {
            throw new Error('No access token found after authentication');
          }

          // Set current user data from login response
          setCurrentUserState(userData);
          dispatch(setCurrentUser(userData));

          // Set authentication as complete
          setIsAuthenticated(true);
          setIsLoading(false);
        } catch (err) {
          console.error('Authentication failed:', err);
          setError(err instanceof Error ? err.message : 'Authentication failed');
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      } else {
        // User is not signed in
        setIsAuthenticated(false);
        setIsLoading(false);
        setError(null);
        setCurrentUserState(null);
        dispatch(clearCurrentUser());
        dispatch(clearLocations());
      }
    };

    handleAuthentication();
  }, [isSignedIn, user, isLoaded, dispatch]);

  // Update locations state when data is fetched
  useEffect(() => {
    if (locationsLoading) {
      dispatch(setLocationsLoading(true));
    } else if (locationsError) {
      dispatch(setLocationsError('Failed to load locations'));
    } else if (locationsData) {
      // The API now returns a simple array of LocationItem objects
      dispatch(setLocations(locationsData));
    }
  }, [locationsData, locationsLoading, locationsError, dispatch]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading: isLoading || (isAuthenticated && locationsLoading),
        error,
        currentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
