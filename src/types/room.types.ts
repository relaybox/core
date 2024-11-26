export enum RoomType {
  PUBLIC = 'public',
  PRIVATE = 'private'
}

export enum RoomMemberType {
  OWNER = 'owner',
  MEMBER = 'member'
}

export interface Room {
  roomId: string;
  roomType: RoomType;
  appPid: string;
  internalId: string;
  createdAt: string;
  memberCreatedAt: string;
  memberType: RoomMemberType;
}
