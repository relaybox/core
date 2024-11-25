import { RoomMemberType, RoomType } from '@/types/room.types';
import { PoolClient, QueryResult } from 'pg';

export function getRoomById(
  pgClient: PoolClient,
  roomId: string,
  clientId: string
): Promise<QueryResult> {
  const query = `
    SELECT 
      r."appPid", 
      r."roomId", 
      r."roomType", 
      r."createdAt", 
      rm."createdAt" AS "memberCreatedAt",
      rm."memberType" AS "memberType"
    FROM rooms r
    LEFT JOIN room_members rm ON rm."roomInternalId" = r."id" 
      AND rm."clientId" = $2
      AND rm."deletedAt" IS NULL
    WHERE r."roomId" = $1;
  `;

  return pgClient.query(query, [roomId, clientId]);
}

export function createRoomIfNotExists(
  pgClient: PoolClient,
  roomId: string,
  roomType: RoomType,
  appPid: string,
  clientId: string,
  connectionId: string,
  socketId: string,
  uid: string
): Promise<QueryResult> {
  const now = new Date().toISOString();

  const query = `
    INSERT INTO rooms (
      "appPid", "roomId", "roomType", uid, "clientId", 
      "connectionId", "socketId", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9
    ) ON CONFLICT ("appPid", "roomId") DO NOTHING RETURNING id;
  `;

  return pgClient.query(query, [
    appPid,
    roomId,
    roomType,
    uid,
    clientId,
    connectionId,
    socketId,
    now,
    now
  ]);
}

export async function addRoomMember(
  pgClient: PoolClient,
  roomId: string,
  roomInternalId: string,
  roomMemberType: RoomMemberType,
  appPid: string,
  clientId: string,
  connectionId: string,
  uid: string
): Promise<QueryResult> {
  const now = new Date().toISOString();

  const query = `
    INSERT INTO room_members (
      "appPid", "roomId", "roomInternalId", uid, "clientId", "memberType", 
      "connectionId", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9
    );
  `;

  return pgClient.query(query, [
    appPid,
    roomId,
    roomInternalId,
    uid,
    clientId,
    roomMemberType,
    connectionId,
    now,
    now
  ]);
}