import { PasswordSaltPair } from '@/types/auth.types';
import { RoomMemberType, RoomVisibility } from '@/types/room.types';
import { PoolClient, QueryResult } from 'pg';

export function getRoomById(
  pgClient: PoolClient,
  appPid: string,
  roomId: string,
  clientId: string
): Promise<QueryResult> {
  const query = `
    SELECT 
      r.id as "internalId",
      r."appPid", 
      r."roomId", 
      r."visibility", 
      r."createdAt", 
      rm."createdAt" AS "memberCreatedAt",
      rm."memberType" AS "memberType",
      r."password",
      r."salt"
    FROM rooms r
    LEFT JOIN room_members rm ON rm."internalId" = r."id" 
      AND rm."clientId" = $3
      AND rm."deletedAt" IS NULL
    WHERE r."roomId" = $2
      AND r."appPid" = $1
      AND r."deletedAt" IS NULL;
  `;

  return pgClient.query(query, [appPid, roomId, clientId]);
}

export function createRoom(
  pgClient: PoolClient,
  roomId: string,
  visibility: RoomVisibility,
  appPid: string,
  clientId: string,
  connectionId: string,
  socketId: string,
  uid: string,
  passwordSaltPair: PasswordSaltPair
): Promise<QueryResult> {
  const now = new Date().toISOString();

  const query = `
    INSERT INTO rooms (
      "appPid", "roomId", "visibility", uid, "clientId", "connectionId", 
      "socketId", "password", "salt", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    ) ON CONFLICT ("appPid", "roomId") 
      DO NOTHING 
      RETURNING id, "roomId", "visibility";
  `;

  return pgClient.query(query, [
    appPid,
    roomId,
    visibility,
    uid,
    clientId,
    connectionId,
    socketId,
    passwordSaltPair.password,
    passwordSaltPair.salt,
    now,
    now
  ]);
}

export async function upsertRoomMember(
  pgClient: PoolClient,
  roomId: string,
  internalId: string,
  roomMemberType: RoomMemberType,
  appPid: string,
  clientId: string,
  connectionId: string,
  uid: string
): Promise<QueryResult> {
  const now = new Date().toISOString();

  const query = `
    INSERT INTO room_members (
      "appPid", "roomId", "internalId", uid, "clientId", "memberType", 
      "connectionId", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9
    ) ON CONFLICT ("appPid", "roomId", "uid") 
      DO 
        UPDATE SET "updatedAt" = EXCLUDED."updatedAt" 
        WHERE room_members.uid = $4
        RETURNING id;
  `;

  return pgClient.query(query, [
    appPid,
    roomId,
    internalId,
    uid,
    clientId,
    roomMemberType,
    connectionId,
    now,
    now
  ]);
}

export function updateRoomPassword(
  pgClient: PoolClient,
  appPid: string,
  roomId: string,
  passwordSaltPair: PasswordSaltPair
): Promise<QueryResult> {
  const now = new Date().toISOString();

  const query = `
    UPDATE rooms
    SET "password" = $3, "salt" = $4
    WHERE "roomId" = $2 AND "appPid" = $1;
  `;

  return pgClient.query(query, [appPid, roomId, passwordSaltPair.password, passwordSaltPair.salt]);
}
