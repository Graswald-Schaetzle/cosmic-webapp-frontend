import { configureStore } from '@reduxjs/toolkit';
import modalReducer from './modalSlice';
import locationsReducer from './locationsSlice';
import userReducer from './userSlice';
import { api } from '../app/api';
import { locationApi } from '../api/locationApi/locationApi';
import { reconstructionApi } from '../api/reconstruction/reconstructionApi';

export const store = configureStore({
  reducer: {
    modal: modalReducer,
    locations: locationsReducer,
    user: userReducer,
    [api.reducerPath]: api.reducer,
    [locationApi.reducerPath]: locationApi.reducer,
    [reconstructionApi.reducerPath]: reconstructionApi.reducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().concat(
      api.middleware,
      locationApi.middleware,
      reconstructionApi.middleware,
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
