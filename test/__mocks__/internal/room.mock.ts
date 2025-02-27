import { Room, RoomMemberType, RoomVisibility } from '@/types/room.types';

export function getMockRoom(roomOptions: Partial<Room> = {}): Room {
  return {
    id: 'internalId1',
    roomId: 'room1',
    visibility: RoomVisibility.PUBLIC,
    appPid: 'app1',
    createdAt: '2024-09-21T08:00:00.000',
    memberCreatedAt: '2024-09-21T08:00:00.000',
    memberType: RoomMemberType.OWNER,
    ...roomOptions
  } as Room;
}
