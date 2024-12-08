export enum RoomVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  PROTECTED = 'protected'
}

export enum RoomMemberType {
  OWNER = 'owner',
  MEMBER = 'member'
}

export interface Room {
  roomId: string;
  visibility: RoomVisibility;
  appPid: string;
  id: string;
  createdAt: string;
  memberCreatedAt: string;
  memberType: RoomMemberType;
  password: string | null;
  salt: string | null;
}

export interface RoomMember {
  id: string;
  appPid: string;
  roomId: string;
  uid: string;
  clientId: string;
  memberType: RoomMemberType;
  roomUuid: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface RoomPrompt {
  id: string;
  roomId: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
}
