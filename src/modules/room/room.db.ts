import { PasswordSaltPair } from '@/types/auth.types';
import { RoomMemberType, RoomVisibility } from '@/types/room.types';
import { getPaginatedQuery } from '@/util/pg-query';
import { PoolClient, QueryResult } from 'pg';

export function getRoomById(
  pgClient: PoolClient,
  appPid: string,
  roomId: string,
  clientId: string
): Promise<QueryResult> {
  const query = `
    SELECT 
      r.id,
      r."appPid", 
      r."roomId", 
      r."roomName", 
      r."visibility", 
      r."createdAt", 
      rm."createdAt" AS "memberCreatedAt",
      rm."memberType" AS "memberType",
      r.password,
      r.salt,
      rm."deletedAt" as "memberDeletedAt"
    FROM rooms r
    LEFT JOIN room_members rm ON rm."roomUuid" = r."id" 
      AND rm."clientId" = $3
    WHERE r."roomId" = $2
      AND r."appPid" = $1
      AND r."deletedAt" IS NULL;
  `;

  return pgClient.query(query, [appPid, roomId, clientId]);
}

export function createRoom(
  pgClient: PoolClient,
  roomId: string,
  roomName: string | null,
  visibility: RoomVisibility,
  appPid: string,
  passwordSaltPair: PasswordSaltPair
): Promise<QueryResult> {
  const now = new Date().toISOString();

  const query = `
    INSERT INTO rooms (
      "appPid", "roomId", "roomName", "visibility", "password", "salt", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $7
    ) ON CONFLICT ("appPid", "roomId") 
      DO NOTHING 
      RETURNING id, "roomId", "roomName", "visibility";
  `;

  return pgClient.query(query, [
    appPid,
    roomId,
    roomName,
    visibility,
    passwordSaltPair.password,
    passwordSaltPair.salt,
    now
  ]);
}

export async function getRoomMember(
  pgClient: PoolClient,
  clientId: string,
  roomUuid: string
): Promise<QueryResult> {
  const query = `
    SELECT * FROM room_members 
    WHERE "clientId" = $1 AND "roomUuid" = $2
  `;

  return await pgClient.query(query, [clientId, roomUuid]);
}

export async function upsertRoomMember(
  pgClient: PoolClient,
  roomId: string,
  roomUuid: string,
  roomMemberType: RoomMemberType,
  appPid: string,
  clientId: string,
  uid: string
): Promise<QueryResult> {
  const now = new Date().toISOString();

  const query = `
    INSERT INTO room_members (
      "appPid", "roomId", "roomUuid", uid, "clientId", "memberType", 
      "createdAt", "updatedAt", "deletedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $7, $8
    ) ON CONFLICT ("appPid", "roomId", "uid") 
      DO 
        UPDATE SET 
          "updatedAt" = EXCLUDED."updatedAt", 
          "deletedAt" = EXCLUDED."deletedAt"
        WHERE room_members.uid = $4
        RETURNING id;
  `;

  return pgClient.query(query, [
    appPid,
    roomId,
    roomUuid,
    uid,
    clientId,
    roomMemberType,
    now,
    null
  ]);
}

export function updateRoomMemberType(
  pgClient: PoolClient,
  roomUuid: string,
  clientId: string,
  roomMemberType: RoomMemberType
): Promise<QueryResult> {
  const now = new Date().toISOString();

  const query = `
    UPDATE room_members 
    SET "memberType" = $3, "updatedAt" = $4
    WHERE "clientId" = $2 AND "roomUuid" = $1
    RETURNING id;
  `;

  return pgClient.query(query, [roomUuid, clientId, roomMemberType, now]);
}

export async function removeRoomMember(
  pgClient: PoolClient,
  clientId: string,
  roomUuid: string
): Promise<QueryResult> {
  const now = new Date().toISOString();

  const query = `
    UPDATE room_members 
    SET "deletedAt" = $3 
    WHERE "clientId" = $1 AND "roomUuid" = $2
    RETURNING id;
  `;

  return pgClient.query(query, [clientId, roomUuid, now]);
}

export function updateRoomPassword(
  pgClient: PoolClient,
  roomUuid: string,
  passwordSaltPair: PasswordSaltPair
): Promise<QueryResult> {
  const now = new Date().toISOString();

  const query = `
    UPDATE rooms
    SET "password" = $2, "salt" = $3
    WHERE "id" = $1;
  `;

  return pgClient.query(query, [roomUuid, passwordSaltPair.password, passwordSaltPair.salt]);
}

export async function getRoomsByClientId(
  pgClient: PoolClient,
  appPid: string,
  clientId: string,
  offset: number = 0,
  limit: number = 10
): Promise<QueryResult> {
  console.log(clientId, appPid);
  const query = `
    SELECT * FROM room_members
    WHERE "clientId" = $1
      AND "appPid" = $2
      AND "deletedAt" IS NULL
    ORDER BY "createdAt" DESC
  `;

  return getPaginatedQuery(pgClient, query, offset, limit, [clientId, appPid]);
}
