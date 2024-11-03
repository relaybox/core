import { PoolClient, QueryResult } from 'pg';

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
