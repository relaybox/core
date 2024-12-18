import { getPaginatedQuery, QueryOrder } from '@/util/pg-query';
import { PoolClient, QueryResult } from 'pg';

export function getMessagesByRoomId(
  pgClient: PoolClient,
  appPid: string,
  roomId: string,
  start: string | null = null,
  end: string | null = null,
  order: QueryOrder = QueryOrder.DESC,
  limit: number,
  lastItemId: string | null = null
): Promise<QueryResult> {
  const queryParams: (string | number)[] = [roomId, appPid];

  let query = `
    SELECT mh.*, 
      CASE
        WHEN au."id" IS NOT NULL THEN json_build_object(
          'id', au."id",
          'clientId', au."clientId",
          'createdAt', au."createdAt",
          'username', au."username",
          'isOnline', au."isOnline",
          'lastOnline', au."lastOnline",
          'blockedAt', au."blockedAt",
          'firstName', au."firstName",
          'lastName', au."lastName"
      )
      ELSE NULL
    END AS user FROM message_history mh
    LEFT JOIN authentication_users au ON mh."clientId" = au."clientId"
    WHERE mh."roomId" = $1 AND mh."appPid" = $2 AND mh."deletedAt" IS NULL
  `;

  if (start) {
    queryParams.push(start);
    query += ` AND mh."createdAt" >= $${queryParams.length}`;
  }

  if (end) {
    queryParams.push(end);
    query += ` AND mh."createdAt" <= $${queryParams.length}`;
  }

  if (lastItemId) {
    queryParams.push(lastItemId);
    query += ` AND mh."id" != $${queryParams.length}`;
  }

  if (order) {
    query += ` ORDER BY mh."createdAt" ${order}`;
  }

  if (limit) {
    query += ` LIMIT ${limit}`;
  }

  return pgClient.query(query, queryParams);
}
