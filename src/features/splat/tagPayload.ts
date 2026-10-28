import { LocationItem } from '../../api/locationApi/locationApi';

/** Payload for `openMatterTagWindow`, same shape the Matterport viewer dispatches on tag click. */
export const locationToTagPayload = (location: LocationItem) =>
  ({
    location_id: location.location_id,
    location_name: location.location_name,
    color: location.color,
    description: location.description,
    x: location.x,
    y: location.y,
    z: location.z,
    keywords: location.keywords,
    floor_id: location.floor_id,
    room_id: location.room_id,
    floor_name: location.floor_name,
    room_name: location.room_name,
    tasks: location.tasks,
    taskError: location.taskError,
    tag_type: location.tag_type,
    responsible_user_id: location.responsible_user_id,
    responsible_user: location.responsible_user,
    created_at: location.created_at,
  }) as never;
