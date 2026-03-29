import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Space } from '../api/spaces/spacesApi';

interface SpaceState {
  activeSpaceId: number | null;
  activeSpace: Space | null;
}

const initialState: SpaceState = {
  activeSpaceId: null,
  activeSpace: null,
};

const spaceSlice = createSlice({
  name: 'space',
  initialState,
  reducers: {
    setActiveSpaceId(state, action: PayloadAction<number | null>) {
      state.activeSpaceId = action.payload;
    },
    setActiveSpace(state, action: PayloadAction<Space | null>) {
      state.activeSpace = action.payload;
      state.activeSpaceId = action.payload?.space_id ?? null;
    },
    clearActiveSpace(state) {
      state.activeSpaceId = null;
      state.activeSpace = null;
    },
  },
});

export const { setActiveSpaceId, setActiveSpace, clearActiveSpace } = spaceSlice.actions;
export default spaceSlice.reducer;
