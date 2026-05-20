import { BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PaginatedRow extends Record<string, unknown> {
  __total?: string;
}

export function parsePaginationQuery(
  page?: string,
  limit?: string,
): PaginationParams | undefined {
  if (page === undefined && limit === undefined) {
    return undefined;
  }

  const parsedPage = page === undefined ? 1 : Number(page);
  const parsedLimit = limit === undefined ? 20 : Number(limit);

  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    throw new BadRequestException('page deve ser um inteiro maior que zero');
  }

  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
    throw new BadRequestException('limit deve ser um inteiro maior que zero');
  }

  return { page: parsedPage, limit: parsedLimit };
}

export async function paginateQuery<T extends object>(
  pool: Pool,
  query: string,
  params: unknown[] = [],
  pagination?: PaginationParams,
): Promise<T[] | PaginationResult<T>> {
  if (!pagination) {
    const result = await pool.query<T>(query, params);
    return result.rows;
  }

  const { page, limit } = pagination;
  const offset = (page - 1) * limit;
  const paginatedQuery = `WITH base AS (${query})
SELECT base.*, COUNT(*) OVER()::text AS __total
FROM base
LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  const result = await pool.query<PaginatedRow>(paginatedQuery, [...params, limit, offset]);
  const total = Number(result.rows[0]?.__total || 0);
  const items = result.rows.map(({ __total, ...row }) => row as T);

  return {
    items,
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}