import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Space,
  useGetMySpacesQuery,
  useGetActiveSpaceQuery,
  useSetActiveSpaceMutation,
  useGetDefaultSpaceQuery,
  useSetDefaultSpaceMutation,
} from '../api/spaces/spacesApi';
import { setActiveSpace, clearActiveSpace } from '../store/spaceSlice';
import { RootState } from '../store/store';

interface SpaceContextType {
  activeSpace: Space | null;
  activeSpaceId: number | null;
  spaces: Space[];
  isLoading: boolean;
  switchSpace: (spaceId: number) => Promise<void>;
  /** Space that is opened first after login / page load (starred in "My Spaces", stored in the backend). */
  defaultSpaceId: number | null;
  /** Star a space as the start space, or pass null to remove the star. */
  setDefaultSpace: (spaceId: number | null) => void;
}

const SpaceContext = createContext<SpaceContextType>({
  activeSpace: null,
  activeSpaceId: null,
  spaces: [],
  isLoading: true,
  switchSpace: async () => {},
  defaultSpaceId: null,
  setDefaultSpace: () => {},
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

  const { data: defaultSpaceId = null, isLoading: defaultSpaceLoading } = useGetDefaultSpaceQuery();
  const [setDefaultSpaceMutation] = useSetDefaultSpaceMutation();
  const initialResolved = useRef(false);

  const setDefaultSpace = useCallback(
    (spaceId: number | null) => {
      setDefaultSpaceMutation(spaceId);
    },
    [setDefaultSpaceMutation]
  );

  // Resolve the start space once per session: starred default space, then the
  // space the server remembers as active, then the first space.
  useEffect(() => {
    if (spacesLoading || activeSpaceLoading || defaultSpaceLoading) return;
    if (spaces.length === 0) {
      dispatch(clearActiveSpace());
      return;
    }

    if (!initialResolved.current) {
      initialResolved.current = true;
      const startSpace =
        spaces.find(s => s.space_id === defaultSpaceId) ??
        spaces.find(s => s.space_id === serverActiveSpaceId) ??
        spaces[0];
      dispatch(setActiveSpace(startSpace));
      if (startSpace.space_id !== serverActiveSpaceId) {
        setActiveSpaceMutation(startSpace.space_id);
      }
      return;
    }

    // Active space disappeared from the user's spaces — fall back to the first one
    if (!activeSpaceId || !spaces.find(s => s.space_id === activeSpaceId)) {
      const firstSpace = spaces[0];
      dispatch(setActiveSpace(firstSpace));
      setActiveSpaceMutation(firstSpace.space_id);
    }
  }, [
    spaces,
    spacesLoading,
    activeSpaceLoading,
    defaultSpaceLoading,
    serverActiveSpaceId,
    activeSpaceId,
    defaultSpaceId,
    dispatch,
    setActiveSpaceMutation,
  ]);

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

  const isLoading = spacesLoading || activeSpaceLoading || defaultSpaceLoading;

  return (
    <SpaceContext.Provider
      value={{
        activeSpace,
        activeSpaceId,
        spaces,
        isLoading,
        switchSpace,
        defaultSpaceId,
        setDefaultSpace,
      }}
    >
      {children}
    </SpaceContext.Provider>
  );
}
