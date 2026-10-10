import { Pool, PoolConfig, QueryResult, QueryResultRow } from "pg";

let poolInstance: Pool | null = null;

export function getPoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    return {
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  }

  return {
    host: process.env.PGHOST || "localhost",
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres",
    database: process.env.PGDATABASE || "cloudpulse",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

export function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool(getPoolConfig());

    poolInstance.on("error", function (err: Error): void {
      console.error("[Database] Unexpected error on idle PostgreSQL client:", err.message);
    });
  }

  return poolInstance;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
