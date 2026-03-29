import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Space,
  useGetMySpacesQuery,
  useGetActiveSpaceQuery,
  useSetActiveSpaceMutation,
} from '../api/spaces/spacesApi';
import { setActiveSpace, clearActiveSpace } from '../store/spaceSlice';
import { RootState } from '../store/store';

interface SpaceContextType {
  activeSpace: Space | null;
  activeSpaceId: number | null;
  spaces: Space[];
  isLoading: boolean;
  switchSpace: (spaceId: number) => Promise<void>;
}

const SpaceContext = createContext<SpaceContextType>({
  activeSpace: null,
  activeSpaceId: null,
  spaces: [],
  isLoading: true,
  switchSpace: async () => {},
});

export const useSpace = () => useContext(SpaceContext);

interface SpaceProviderProps {
  children: React.ReactNode;
}

export function SpaceProvider({ children }: SpaceProviderProps) {
  const dispatch = useDispatch();
  const { activeSpaceId, activeSpace } = useSelector((state: RootState) => state.space);

  const { data: spaces = [], isLoading: spacesLoading } = useGetMySpacesQuery();
  const { data: serverActiveSpaceId, isLoading: activeSpaceLoading } = useGetActiveSpaceQuery();
  const [setActiveSpaceMutation] = useSetActiveSpaceMutation();

  // Resolve active space from server response or auto-select first space
  useEffect(() => {
    if (spacesLoading || activeSpaceLoading) return;
    if (spaces.length === 0) {
      dispatch(clearActiveSpace());
      return;
    }

    // If server has an active space and it still exists in user's spaces, use it
    if (serverActiveSpaceId) {
      const serverSpace = spaces.find(s => s.space_id === serverActiveSpaceId);
      if (serverSpace) {
        if (activeSpaceId !== serverSpace.space_id) {
          dispatch(setActiveSpace(serverSpace));
        }
        return;
      }
    }

    // No valid server active space — auto-select first space
    if (!activeSpaceId || !spaces.find(s => s.space_id === activeSpaceId)) {
      const firstSpace = spaces[0];
      dispatch(setActiveSpace(firstSpace));
      setActiveSpaceMutation(firstSpace.space_id);
    }
  }, [spaces, spacesLoading, activeSpaceLoading, serverActiveSpaceId, activeSpaceId, dispatch, setActiveSpaceMutation]);

  // Keep activeSpace object in sync when spaces data refreshes
  useEffect(() => {
    if (activeSpaceId && spaces.length > 0) {
      const current = spaces.find(s => s.space_id === activeSpaceId);
      if (current && current !== activeSpace) {
        dispatch(setActiveSpace(current));
      }
    }
  }, [spaces, activeSpaceId, activeSpace, dispatch]);

  const switchSpace = useCallback(
    async (spaceId: number) => {
      const space = spaces.find(s => s.space_id === spaceId);
      if (!space) return;
      dispatch(setActiveSpace(space));
      await setActiveSpaceMutation(spaceId);
    },
    [spaces, dispatch, setActiveSpaceMutation]
  );

  const isLoading = spacesLoading || activeSpaceLoading;

  return (
    <SpaceContext.Provider
      value={{
        activeSpace,
        activeSpaceId,
        spaces,
        isLoading,
        switchSpace,
      }}
    >
      {children}
    </SpaceContext.Provider>
  );
}
