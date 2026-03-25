import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LocationItem } from '../api/locationApi/locationApi';
import { RootState } from './store';

interface LocationsState {
  locations: LocationItem[];
  isLoading: boolean;
  error: string | null;
}

const initialState: LocationsState = {
  locations: [],
  isLoading: false,
  error: null,
};

const locationsSlice = createSlice({
  name: 'locations',
  initialState,
  reducers: {
    setLocations: (state, action: PayloadAction<LocationItem[]>) => {
      state.locations = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    setLocationsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setLocationsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearLocations: state => {
      state.locations = [];
      state.isLoading = false;
      state.error = null;
    },
  },
});

export const { setLocations, setLocationsLoading, setLocationsError, clearLocations } =
  locationsSlice.actions;

// Selectors
export const selectLocations = (state: RootState) => state.locations.locations;
export const selectLocationsLoading = (state: RootState) => state.locations.isLoading;
export const selectLocationsError = (state: RootState) => state.locations.error;

export const selectLocationByTagId = (state: RootState, matterportTagId: string) => {
  return state.locations.locations.find(location => location.location_id === matterportTagId);
};

export const selectLocationById = (state: RootState, locationId: string) =>
  state.locations.locations.find(location => location.location_id === locationId);

export const selectLocationIdByTagId = (state: RootState, matterportTagId: string) => {
  const location = state.locations.locations.find(
    location => location.location_id === matterportTagId
  );
  return location?.location_id;
};

export default locationsSlice.reducer;
