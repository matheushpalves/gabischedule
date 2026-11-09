import pg from 'pg';

// Retorna colunas `date` como texto YYYY-MM-DD (sem conversão de fuso).
pg.types.setTypeParser(1082, (v) => v);
// bigint/count como número.
pg.types.setTypeParser(20, (v) => Number(v));

export type Db = pg.Pool;

export function createPool(connectionString: string): Db {
  return new pg.Pool({ connectionString, max: 10 });
}
