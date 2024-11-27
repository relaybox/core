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
  passwordSaltPair: PasswordSaltPair
): Promise<QueryResult> {
  const now = new Date().toISOString();

  const query = `
    INSERT INTO rooms (
      "appPid", "roomId", "visibility", 
      "password", "salt", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $6
    ) ON CONFLICT ("appPid", "roomId") 
      DO NOTHING 
      RETURNING id, "roomId", "visibility";
  `;

  return pgClient.query(query, [
    appPid,
    roomId,
    visibility,
    passwordSaltPair.password,
    passwordSaltPair.salt,
    now
  ]);
}

export async function getRoomMember(
  pgClient: PoolClient,
  clientId: string,
  internalId: string
): Promise<QueryResult> {
  const query = `
    SELECT * FROM room_members 
    WHERE "clientId" = $1 AND "internalId" = $2
  `;

  return await pgClient.query(query, [clientId, internalId]);
}

export async function upsertRoomMember(
  pgClient: PoolClient,
  roomId: string,
  internalId: string,
  roomMemberType: RoomMemberType,
  appPid: string,
  clientId: string,
  uid: string
): Promise<QueryResult> {
  const now = new Date().toISOString();

  const query = `
    INSERT INTO room_members (
      "appPid", "roomId", "internalId", uid, "clientId", "memberType", 
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
    internalId,
    uid,
    clientId,
    roomMemberType,
    now,
    null
  ]);
}

export async function removeRoomMember(
  pgClient: PoolClient,
  clientId: string,
  internalId: string
): Promise<QueryResult> {
  const now = new Date().toISOString();

  const query = `
    UPDATE room_members 
    SET "deletedAt" = $3 
    WHERE "clientId" = $1 AND "internalId" = $2
    RETURNING id;
  `;

  return pgClient.query(query, [clientId, internalId, now]);
}

export function updateRoomPassword(
  pgClient: PoolClient,
  internalId: string,
  passwordSaltPair: PasswordSaltPair
): Promise<QueryResult> {
  const now = new Date().toISOString();

  const query = `
    UPDATE rooms
    SET "password" = $2, "salt" = $3
    WHERE "id" = $1;
  `;

  return pgClient.query(query, [internalId, passwordSaltPair.password, passwordSaltPair.salt]);
}
