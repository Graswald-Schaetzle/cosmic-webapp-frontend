import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { LocationItem } from '../api/locationApi/locationApi';
import {
  selectLocations,
  selectLocationsLoading,
  selectLocationsError,
  selectLocationByTagId,
  selectLocationById,
  selectLocationIdByTagId,
} from '../store/locationsSlice';

export const useLocations = () => {
  const locations = useSelector(selectLocations);
  const isLoading = useSelector(selectLocationsLoading);
  const error = useSelector(selectLocationsError);

  return {
    locations,
    isLoading,
    error,
  };
};

export const useLocationById = (locationId: string): LocationItem | undefined => {
  return useSelector((state: RootState) => selectLocationById(state, locationId));
};

export const useLocationByTagId = (matterportTagId: string): LocationItem | undefined => {
  return useSelector((state: RootState) => selectLocationByTagId(state, matterportTagId));
};

export const useLocationIdByTagId = (matterportTagId: string): string | undefined => {
  return useSelector((state: RootState) => selectLocationIdByTagId(state, matterportTagId));
};
