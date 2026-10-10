import { AlertSeverity } from "./alert.types";

export type IncidentStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export interface Incident {
  id: string;
  serviceId: string;
  title: string;
  status: IncidentStatus;
  severity: AlertSeverity;
  summary: string | null;
  openedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  alerts?: string[]; // Alert IDs associated with this incident
}

export interface IncidentRow {
  id: string;
  service_id: string;
  title: string;
  status: string;
  severity: string;
  summary: string | null;
  opened_at: Date;
  acknowledged_at: Date | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
