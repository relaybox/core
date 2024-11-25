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
