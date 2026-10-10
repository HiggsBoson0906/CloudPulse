import { query } from "../pool";
import {
  CreateServiceInput,
  ServiceRecord,
  ServiceRow,
  UpdateServiceInput,
} from "../../types/service.types";

export function mapRowToService(row: ServiceRow): ServiceRecord {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    healthCheckPath: row.health_check_path,
    environment: row.environment as ServiceRecord["environment"],
    checkIntervalSeconds: row.check_interval_seconds,
    timeoutMs: row.timeout_ms,
    isEnabled: row.is_enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function createService(input: CreateServiceInput): Promise<ServiceRecord> {
  const sql = `
    INSERT INTO services (
      name,
      base_url,
      health_check_path,
      environment,
      check_interval_seconds,
      timeout_ms,
      is_enabled
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING
      id,
      name,
      base_url,
      health_check_path,
      environment,
      check_interval_seconds,
      timeout_ms,
      is_enabled,
      created_at,
      updated_at;
  `;

  const params: unknown[] = [
    input.name,
    input.baseUrl,
    input.healthCheckPath ?? "/health",
    input.environment,
    input.checkIntervalSeconds ?? 30,
    input.timeoutMs ?? 5000,
    input.isEnabled ?? true,
  ];

  const result = await query<ServiceRow>(sql, params);
  return mapRowToService(result.rows[0]);
}

export async function listServices(filter?: {
  environment?: string;
  isEnabled?: boolean;
}): Promise<ServiceRecord[]> {
  const whereClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filter?.environment) {
    whereClauses.push(`environment = $${paramIdx++}`);
    params.push(filter.environment);
  }

  if (filter?.isEnabled !== undefined) {
    whereClauses.push(`is_enabled = $${paramIdx++}`);
    params.push(filter.isEnabled);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const sql = `
    SELECT
      id,
      name,
      base_url,
      health_check_path,
      environment,
      check_interval_seconds,
      timeout_ms,
      is_enabled,
      created_at,
      updated_at
    FROM services
    ${whereSql}
    ORDER BY created_at DESC;
  `;

  const result = await query<ServiceRow>(sql, params);
  return result.rows.map(mapRowToService);
}

export async function getServiceById(id: string): Promise<ServiceRecord | null> {
  const sql = `
    SELECT
      id,
      name,
      base_url,
      health_check_path,
      environment,
      check_interval_seconds,
      timeout_ms,
      is_enabled,
      created_at,
      updated_at
    FROM services
    WHERE id = $1;
  `;

  const result = await query<ServiceRow>(sql, [id]);
  if (result.rows.length === 0) return null;
  return mapRowToService(result.rows[0]);
}

export async function findByNameAndEnvironment(
  name: string,
  environment: string
): Promise<ServiceRecord | null> {
  const sql = `
    SELECT
      id,
      name,
      base_url,
      health_check_path,
      environment,
      check_interval_seconds,
      timeout_ms,
      is_enabled,
      created_at,
      updated_at
    FROM services
    WHERE LOWER(name) = LOWER($1) AND environment = $2;
  `;

  const result = await query<ServiceRow>(sql, [name, environment]);
  if (result.rows.length === 0) return null;
  return mapRowToService(result.rows[0]);
}

export async function updateService(
  id: string,
  input: UpdateServiceInput
): Promise<ServiceRecord | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    params.push(input.name);
  }

  if (input.baseUrl !== undefined) {
    setClauses.push(`base_url = $${paramIndex++}`);
    params.push(input.baseUrl);
  }

  if (input.healthCheckPath !== undefined) {
    setClauses.push(`health_check_path = $${paramIndex++}`);
    params.push(input.healthCheckPath);
  }

  if (input.environment !== undefined) {
    setClauses.push(`environment = $${paramIndex++}`);
    params.push(input.environment);
  }

  if (input.checkIntervalSeconds !== undefined) {
    setClauses.push(`check_interval_seconds = $${paramIndex++}`);
    params.push(input.checkIntervalSeconds);
  }

  if (input.timeoutMs !== undefined) {
    setClauses.push(`timeout_ms = $${paramIndex++}`);
    params.push(input.timeoutMs);
  }

  if (input.isEnabled !== undefined) {
    setClauses.push(`is_enabled = $${paramIndex++}`);
    params.push(input.isEnabled);
  }

  if (setClauses.length === 0) {
    return getServiceById(id);
  }

  setClauses.push(`updated_at = NOW()`);
  params.push(id);
  const idPlaceholder = `$${paramIndex}`;

  const sql = `
    UPDATE services
    SET ${setClauses.join(", ")}
    WHERE id = ${idPlaceholder}
    RETURNING
      id,
      name,
      base_url,
      health_check_path,
      environment,
      check_interval_seconds,
      timeout_ms,
      is_enabled,
      created_at,
      updated_at;
  `;

  const result = await query<ServiceRow>(sql, params);
  if (result.rows.length === 0) return null;
  return mapRowToService(result.rows[0]);
}

export async function deleteService(id: string): Promise<boolean> {
  const sql = `
    DELETE FROM services
    WHERE id = $1;
  `;

  const result = await query(sql, [id]);
  return (result.rowCount ?? 0) > 0;
}
