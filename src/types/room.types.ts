export enum RoomType {
  PUBLIC = 'public',
  PRIVATE = 'private'
}

export enum RoomMemberType {
  OWNER = 'owner'
}

export interface Room {
  appPid: string;
  roomId: string;
  roomType: RoomType;
  createdAt: string;
  memberCreatedAt: string;
  memberType: RoomMemberType;
}
