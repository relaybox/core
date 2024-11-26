import { RoomMemberType, RoomVisibility } from '@/types/room.types';
import { PoolClient, QueryResult } from 'pg';

export function getRoomById(
  pgClient: PoolClient,
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
      rm."memberType" AS "memberType"
    FROM rooms r
    LEFT JOIN room_members rm ON rm."internalId" = r."id" 
      AND rm."clientId" = $2
      AND rm."deletedAt" IS NULL
    WHERE r."roomId" = $1;
  `;

  return pgClient.query(query, [roomId, clientId]);
}

export function createRoom(
  pgClient: PoolClient,
  roomId: string,
  visibility: RoomVisibility,
  appPid: string,
  clientId: string,
  connectionId: string,
  socketId: string,
  uid: string
): Promise<QueryResult> {
  const now = new Date().toISOString();

  const query = `
    INSERT INTO rooms (
      "appPid", "roomId", "visibility", uid, "clientId", 
      "connectionId", "socketId", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9
    ) ON CONFLICT ("appPid", "roomId") 
      DO NOTHING 
      RETURNING id, "visibility";
  `;

  return pgClient.query(query, [
    appPid,
    roomId,
    visibility,
    uid,
    clientId,
    connectionId,
    socketId,
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
        WHERE room_members.uid = $4;
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
