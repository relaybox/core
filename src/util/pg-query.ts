import { PoolClient, QueryResult } from 'pg';

export interface PaginatedQueryResult<T> {
  count: number;
  data: T[];
}

export enum QueryOrder {
  ASC = 'ASC',
  DESC = 'DESC'
}

export function isPaginationRequest(offset?: number, limit?: number): boolean {
  return offset !== undefined && limit !== undefined;
}

export function getPaginatedQuery(
  pgClient: PoolClient,
  baseQuery: string,
  offset: number,
  limit: number,
  values: any[]
): Promise<QueryResult> {
  if (!isPaginationRequest(offset, limit)) {
    return pgClient.query(baseQuery, values);
  }

  const paginatedQuery = `
    WITH base_data AS (
      ${baseQuery}
    ),
    total_count AS (
      SELECT COUNT(*) AS count FROM base_data
    )
    SELECT 
      (SELECT count FROM total_count)::int AS count,
      json_agg(limited_data.*) AS data
    FROM (
      SELECT * FROM base_data
      OFFSET $${values.length + 1}
      LIMIT $${values.length + 2}
    ) as limited_data;
  `;

  return pgClient.query(paginatedQuery, [...values, offset, limit]);
}
