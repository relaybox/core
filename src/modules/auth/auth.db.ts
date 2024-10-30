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
