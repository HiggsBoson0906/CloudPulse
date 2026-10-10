import { query } from "../pool";
import { AlertSeverity } from "../../types/alert.types";
import { Incident, IncidentRow, IncidentStatus } from "../../types/incident.types";

export function mapRowToIncident(row: IncidentRow, alertIds: string[] = []): Incident {
  return {
    id: row.id,
    serviceId: row.service_id,
    title: row.title,
    status: row.status as IncidentStatus,
    severity: row.severity as AlertSeverity,
    summary: row.summary,
    openedAt: row.opened_at.toISOString(),
    acknowledgedAt: row.acknowledged_at ? row.acknowledged_at.toISOString() : null,
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    alerts: alertIds,
  };
}

export async function createIncident(data: {
  serviceId: string;
  title: string;
  severity: AlertSeverity;
  summary?: string;
}): Promise<Incident> {
  const sql = `
    INSERT INTO incidents (
      service_id,
      title,
      status,
      severity,
      summary
    ) VALUES ($1, $2, 'OPEN', $3, $4)
    RETURNING
      id,
      service_id,
      title,
      status,
      severity,
      summary,
      opened_at,
      acknowledged_at,
      resolved_at,
      created_at,
      updated_at;
  `;

  const params: unknown[] = [
    data.serviceId,
    data.title,
    data.severity,
    data.summary ?? null,
  ];

  const result = await query<IncidentRow>(sql, params);
  return mapRowToIncident(result.rows[0]);
}

export async function getOpenIncidentForService(serviceId: string): Promise<Incident | null> {
  const sql = `
    SELECT
      id,
      service_id,
      title,
      status,
      severity,
      summary,
      opened_at,
      acknowledged_at,
      resolved_at,
      created_at,
      updated_at
    FROM incidents
    WHERE service_id = $1 AND status IN ('OPEN', 'ACKNOWLEDGED')
    ORDER BY opened_at DESC
    LIMIT 1;
  `;

  const result = await query<IncidentRow>(sql, [serviceId]);
  if (result.rows.length === 0) return null;

  const alerts = await getAlertIdsForIncident(result.rows[0].id);
  return mapRowToIncident(result.rows[0], alerts);
}

export async function getIncidentById(id: string): Promise<Incident | null> {
  const sql = `
    SELECT
      id,
      service_id,
      title,
      status,
      severity,
      summary,
      opened_at,
      acknowledged_at,
      resolved_at,
      created_at,
      updated_at
    FROM incidents
    WHERE id = $1;
  `;

  const result = await query<IncidentRow>(sql, [id]);
  if (result.rows.length === 0) return null;

  const alerts = await getAlertIdsForIncident(id);
  return mapRowToIncident(result.rows[0], alerts);
}

export async function getAlertIdsForIncident(incidentId: string): Promise<string[]> {
  const sql = `
    SELECT alert_id
    FROM incident_alerts
    WHERE incident_id = $1;
  `;

  const result = await query<{ alert_id: string }>(sql, [incidentId]);
  return result.rows.map(function (r) {
    return r.alert_id;
  });
}

export async function linkAlertToIncident(incidentId: string, alertId: string): Promise<void> {
  const sql = `
    INSERT INTO incident_alerts (incident_id, alert_id)
    VALUES ($1, $2)
    ON CONFLICT (incident_id, alert_id) DO NOTHING;
  `;

  await query(sql, [incidentId, alertId]);
}

export async function listIncidents(filter?: {
  serviceId?: string;
  status?: string;
  limit?: number;
}): Promise<Incident[]> {
  const whereClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filter?.serviceId) {
    whereClauses.push(`service_id = $${paramIdx++}`);
    params.push(filter.serviceId);
  }

  if (filter?.status) {
    whereClauses.push(`status = $${paramIdx++}`);
    params.push(filter.status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const limitVal = filter?.limit ?? 100;
  params.push(limitVal);
  const limitPlaceholder = `$${paramIdx}`;

  const sql = `
    SELECT
      id,
      service_id,
      title,
      status,
      severity,
      summary,
      opened_at,
      acknowledged_at,
      resolved_at,
      created_at,
      updated_at
    FROM incidents
    ${whereSql}
    ORDER BY opened_at DESC
    LIMIT ${limitPlaceholder};
  `;

  const result = await query<IncidentRow>(sql, params);

  // Map each incident
  const incidents: Incident[] = [];
  for (const row of result.rows) {
    const alerts = await getAlertIdsForIncident(row.id);
    incidents.push(mapRowToIncident(row, alerts));
  }

  return incidents;
}

export async function acknowledgeIncident(id: string): Promise<Incident | null> {
  const sql = `
    UPDATE incidents
    SET status = 'ACKNOWLEDGED', acknowledged_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND status = 'OPEN'
    RETURNING
      id,
      service_id,
      title,
      status,
      severity,
      summary,
      opened_at,
      acknowledged_at,
      resolved_at,
      created_at,
      updated_at;
  `;

  const result = await query<IncidentRow>(sql, [id]);
  if (result.rows.length === 0) return null;

  const alerts = await getAlertIdsForIncident(id);
  return mapRowToIncident(result.rows[0], alerts);
}

export async function resolveIncident(id: string): Promise<Incident | null> {
  const sql = `
    UPDATE incidents
    SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND status IN ('OPEN', 'ACKNOWLEDGED')
    RETURNING
      id,
      service_id,
      title,
      status,
      severity,
      summary,
      opened_at,
      acknowledged_at,
      resolved_at,
      created_at,
      updated_at;
  `;

  const result = await query<IncidentRow>(sql, [id]);
  if (result.rows.length === 0) return null;

  const alerts = await getAlertIdsForIncident(id);
  return mapRowToIncident(result.rows[0], alerts);
}
