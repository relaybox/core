export enum RoomVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private'
}

export enum RoomMemberType {
  OWNER = 'owner',
  MEMBER = 'member'
}

export interface Room {
  roomId: string;
  visibility: RoomVisibility;
  appPid: string;
  internalId: string;
  createdAt: string;
  memberCreatedAt: string;
  memberType: RoomMemberType;
}
