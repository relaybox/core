import { PoolClient, QueryResult } from 'pg';

export function getSecretKeybyKeyId(
  pgClient: PoolClient,
  appPid: string,
  keyId: string
): Promise<QueryResult> {
  const query = `
    SELECT "secretKey" 
    FROM credentials 
    WHERE "keyId" = $1 AND "appPid" = $2;
  `;

  return pgClient.query(query, [keyId, appPid]);
}

export function getUserByClientId(pgClient: PoolClient, clientId: string): Promise<QueryResult> {
  const query = `
    SELECT 
      id, 
      "appId", 
      "blockedAt", 
      "clientId", 
      "createdAt", 
      "firstName", 
      "lastName", 
      "isOnline", 
      "lastOnline", 
      "orgId", 
      "updatedAt", 
      "username"
    FROM authentication_users
    WHERE "clientId" = $1;
  `;

  return pgClient.query(query, [clientId]);
}
