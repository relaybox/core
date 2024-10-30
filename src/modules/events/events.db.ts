import { QueryResult, PoolClient } from 'pg';

// export function getSecretKeybyKeyId(
//   pgClient: PoolClient,
//   appPid: string,
//   keyId: string
// ): Promise<QueryResult> {
//   const query = `
//     SELECT "secretKey"
//     FROM credentials
//     WHERE "keyId" = $1 AND "appPid" = $2;
//   `;

//   return pgClient.query(query, [keyId, appPid]);
// }

export function getPermissionsByKeyId(pgClient: PoolClient, keyId: string): Promise<QueryResult> {
  const query = `
    SELECT cpe.permission, cpa.pattern
    FROM credentials c
    LEFT JOIN credential_permissions cpe ON cpe."credentialId" = c.id
    LEFT JOIN credential_patterns cpa ON cpa."credentialId" = c.id
    WHERE c."keyId" = $1;
  `;

  return pgClient.query(query, [keyId]);
}

export function getHistoryTtlhours(pgClient: PoolClient, appPid: string): Promise<QueryResult> {
  const query = `
    SELECT "historyTtlHours"
    FROM applications
    WHERE pid = $1;
  `;

  return pgClient.query(query, [appPid]);
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
