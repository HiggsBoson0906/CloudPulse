import fs from "fs";
import path from "path";
import { getPool, closePool } from "./pool";

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    console.log("[Migration] Ensuring schema_migrations table exists...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Look for migrations in root migrations/ or relative to dist
    const possiblePaths = [
      path.resolve(process.cwd(), "migrations"),
      path.resolve(__dirname, "../../migrations"),
      path.resolve(__dirname, "../migrations"),
    ];

    let migrationsDir: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        migrationsDir = p;
        break;
      }
    }

    if (!migrationsDir) {
      throw new Error(
        `Migrations directory could not be located in: ${possiblePaths.join(", ")}`
      );
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter(function (file: string): boolean {
        return file.endsWith(".sql");
      })
      .sort();

    const appliedResult = await client.query<{ version: string }>(
      "SELECT version FROM schema_migrations"
    );
    const appliedVersions = new Set<string>(
      appliedResult.rows.map(function (row): string {
        return row.version;
      })
    );

    for (const file of files) {
      if (appliedVersions.has(file)) {
        console.log(`[Migration] Already applied: ${file}`);
        continue;
      }

      console.log(`[Migration] Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, "utf-8");

      await client.query("BEGIN");
      try {
        await client.query(sqlContent);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        console.log(`[Migration] Successfully applied: ${file}`);
      } catch (migrationError) {
        await client.query("ROLLBACK");
        console.error(`[Migration] Failed applying ${file}:`, migrationError);
        throw migrationError;
      }
    }

    console.log("[Migration] Migration execution complete. Database is up to date.");
  } finally {
    client.release();
  }
}

// Support direct invocation via node CLI
if (require.main === module) {
  runMigrations()
    .then(async function (): Promise<void> {
      await closePool();
      process.exit(0);
    })
    .catch(async function (error: unknown): Promise<void> {
      console.error("[Migration] Migration runner encountered a fatal error:", error);
      await closePool();
      process.exit(1);
    });
}
