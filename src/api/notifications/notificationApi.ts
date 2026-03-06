import { api } from '../../app/api';

// Notification types
export interface Notification {
  notification_id: number;
  created_at: string;
  name: string;
  text: string;
  is_new: boolean;
  type: string;
  user_id: number;
  room_id: number;
  location_id: string | null;
  document_id: number | null;
  task_id: number | null;
  floor_id: number;
}

export interface NotificationRoom {
  room_id: number;
  room_name: string;
  notifications: Notification[];
  newCount: number;
}

export interface NotificationFloor {
  floor_id: number;
  floor_name: string;
  newCount: number;
  rooms: NotificationRoom[];
}

export interface NotificationsResponse {
  totalNewCount: number;
  floors: NotificationFloor[];
}

// Mark read payload
export interface MarkReadPayload {
  notification_id?: number;
  room_id?: number;
  floor_id?: number;
}

// Mark all read payload (empty object for this endpoint)
export interface MarkAllReadPayload {}

// Create notification payload
export interface CreateNotificationPayload {
  name: string;
  text: string;
  type: string;
  is_new: boolean;
  room_id?: number;
  location_id?: string;
  document_id?: number;
  task_id?: number;
  floor_id?: number;
  user_id?: number;
}

// Last activities response
export interface LastActivitiesResponse {
  notifications: Notification[];
}

// RTK Query endpoints
export const notificationApi = api.injectEndpoints({
  endpoints: builder => ({
    getNotifications: builder.query<NotificationsResponse, { floor_id?: number; room_id?: number }>(
      {
        query: params => ({
          url: '/notifications',
          method: 'GET',
          params,
        }),
        providesTags: ['Notifications'],
      }
    ),

    markNotificationsAsRead: builder.mutation<void, MarkReadPayload>({
      query: payload => ({
        url: '/notifications/mark-read',
        method: 'PUT',
        body: payload,
      }),
      invalidatesTags: ['Notifications'],
    }),

    markAllNotificationsAsRead: builder.mutation<void, MarkAllReadPayload>({
      query: () => ({
        url: '/notifications/mark-all-read',
        method: 'PUT',
      }),
      invalidatesTags: ['Notifications'],
    }),

    createNotification: builder.mutation<void, CreateNotificationPayload>({
      query: payload => ({
        url: '/notifications',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['Notifications'],
    }),

    getLastActivities: builder.query<LastActivitiesResponse, void>({
      query: () => ({
        url: '/last-activities',
        method: 'GET',
      }),
      providesTags: ['Notifications'],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useMarkNotificationsAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
  useCreateNotificationMutation,
  useGetLastActivitiesQuery,
} = notificationApi;
