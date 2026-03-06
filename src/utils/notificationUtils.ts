import { useCreateNotificationMutation } from '../api/notifications/notificationApi';
import { store } from '../store/store';
import { selectLocationById } from '../store/locationsSlice';

// Helper function to get floor_id and room_id from location_id
const getLocationIds = (locationId?: string) => {
  if (!locationId) return { floor_id: undefined, room_id: undefined };

  const state = store.getState();
  const location = selectLocationById(state, locationId);

  return {
    floor_id: location?.floor_id,
    room_id: location?.room_id,
  };
};

// Helper function to create notifications
export const createNotification = async (
  createNotificationMutation: ReturnType<typeof useCreateNotificationMutation>[0],
  notificationData: {
    name: string;
    text: string;
    type: string;
    room_id?: number;
    location_id?: string;
    document_id?: number;
    task_id?: number;
    floor_id?: number;
    user_id?: number;
  }
) => {
  try {
    const currentUser = store.getState().user.currentUser;
    const { floor_id, room_id } = getLocationIds(notificationData.location_id);

    await createNotificationMutation({
      name: notificationData.name,
      text: notificationData.text,
      type: notificationData.type,
      is_new: true,
      room_id: notificationData.room_id || room_id,
      location_id: notificationData.location_id,
      document_id: notificationData.document_id,
      task_id: notificationData.task_id,
      floor_id: notificationData.floor_id || floor_id,
      user_id: currentUser?.user_id,
    }).unwrap();
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

// Task notification helpers
export const createTaskCreatedNotification = async (
  createNotificationMutation: ReturnType<typeof useCreateNotificationMutation>[0],
  taskTitle: string,
  assigneeName: string,
  locationName: string,
  taskId: number,
  locationId?: string
) => {
  await createNotification(createNotificationMutation, {
    name: 'Task Created',
    text: `New task "${taskTitle}" has been created and assigned to ${assigneeName} at ${locationName}`,
    type: 'task',
    task_id: taskId,
    location_id: locationId,
  });
};

export const createTaskUpdatedNotification = async (
  createNotificationMutation: ReturnType<typeof useCreateNotificationMutation>[0],
  taskTitle: string,
  fieldName: string,
  newValue: string,
  taskId: number,
  locationId?: string
) => {
  await createNotification(createNotificationMutation, {
    name: 'Task Updated',
    text: `Task "${taskTitle}" ${fieldName} has been updated to "${newValue}"`,
    type: 'task',
    task_id: taskId,
    location_id: locationId,
  });
};

export const createTaskDeletedNotification = async (
  createNotificationMutation: ReturnType<typeof useCreateNotificationMutation>[0],
  taskTitle: string,
  locationId?: string
) => {
  await createNotification(createNotificationMutation, {
    name: 'Task Deleted',
    text: `Task "${taskTitle}" has been deleted`,
    type: 'task',
    location_id: locationId,
  });
};

// Document notification helpers
export const createDocumentAddedNotification = async (
  createNotificationMutation: ReturnType<typeof useCreateNotificationMutation>[0],
  documentName: string,
  locationName: string,
  documentId: number,
  locationId?: string
) => {
  await createNotification(createNotificationMutation, {
    name: 'Document Added',
    text: `New document "${documentName}" has been added to ${locationName}`,
    type: 'document',
    document_id: documentId,
    location_id: locationId,
  });
};

export const createDocumentDeletedNotification = async (
  createNotificationMutation: ReturnType<typeof useCreateNotificationMutation>[0],
  documentName: string,
  locationName: string,
  locationId?: string
) => {
  await createNotification(createNotificationMutation, {
    name: 'Document Deleted',
    text: `Document "${documentName}" has been deleted from ${locationName}`,
    type: 'document',
    location_id: locationId,
  });
};

// List notification helpers
export const createListCreatedNotification = async (
  createNotificationMutation: ReturnType<typeof useCreateNotificationMutation>[0],
  listName: string,
  roomId?: number,
  floorId?: number
) => {
  await createNotification(createNotificationMutation, {
    name: 'List Created',
    text: `New list "${listName}" has been created`,
    type: 'list',
    room_id: roomId,
    floor_id: floorId,
  });
};

export const createListDeletedNotification = async (
  createNotificationMutation: ReturnType<typeof useCreateNotificationMutation>[0],
  listName: string,
  roomId?: number,
  floorId?: number
) => {
  await createNotification(createNotificationMutation, {
    name: 'List Deleted',
    text: `List "${listName}" has been deleted`,
    type: 'list',
    room_id: roomId,
    floor_id: floorId,
  });
};

export const createListUpdatedNotification = async (
  createNotificationMutation: ReturnType<typeof useCreateNotificationMutation>[0],
  listName: string,
  action: string,
  roomId?: number,
  floorId?: number
) => {
  await createNotification(createNotificationMutation, {
    name: 'List Updated',
    text: `List "${listName}" has been ${action}`,
    type: 'list',
    room_id: roomId,
    floor_id: floorId,
  });
};
