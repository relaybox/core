export enum RoomType {
  PUBLIC = 'public',
  PRIVATE = 'private'
}

export enum RoomMemberType {
  OWNER = 'owner',
  MEMBER = 'member'
}

export interface Room {
  internalId: string;
  appPid: string;
  roomId: string;
  roomType: RoomType;
  createdAt: string;
  memberCreatedAt: string;
  memberType: RoomMemberType;
}
