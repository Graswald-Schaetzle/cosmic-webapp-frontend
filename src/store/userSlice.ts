import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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

interface UserState {
  currentUser: CurrentUser | null;
}

const initialState: UserState = {
  currentUser: null,
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setCurrentUser: (state, action: PayloadAction<CurrentUser>) => {
      state.currentUser = action.payload;
    },
    clearCurrentUser: state => {
      state.currentUser = null;
    },
  },
});

export const { setCurrentUser, clearCurrentUser } = userSlice.actions;
export default userSlice.reducer;
