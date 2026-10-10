import { Request, Response } from "express";
import * as incidentsRepo from "../db/repositories/incidents.repo";
import { isValidUUID } from "./services.controller";
import { IncidentStatus } from "../types/incident.types";

const VALID_STATUSES: readonly IncidentStatus[] = ["OPEN", "ACKNOWLEDGED", "RESOLVED"];

export async function listIncidentsHandler(req: Request, res: Response): Promise<void> {
  try {
    const statusQuery = req.query.status as IncidentStatus | undefined;
    const serviceId = req.query.serviceId as string | undefined;

    if (statusQuery && !VALID_STATUSES.includes(statusQuery)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
      return;
    }

    if (serviceId && !isValidUUID(serviceId)) {
      res.status(400).json({ error: "Invalid serviceId query parameter" });
      return;
    }

    const incidents = await incidentsRepo.listIncidents({
      status: statusQuery,
      serviceId,
    });

    res.status(200).json(incidents);
  } catch (error: unknown) {
    console.error("[Controller] listIncidentsHandler failed:", error);
    res.status(500).json({ error: "Failed to list incidents" });
  }
}

export async function getIncidentByIdHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : "";

    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid incident ID" });
      return;
    }

    const incident = await incidentsRepo.getIncidentById(id);
    if (!incident) {
      res.status(404).json({ error: `Incident with ID '${id}' not found` });
      return;
    }

    res.status(200).json(incident);
  } catch (error: unknown) {
    console.error("[Controller] getIncidentByIdHandler failed:", error);
    res.status(500).json({ error: "Failed to retrieve incident" });
  }
}

export async function acknowledgeIncidentHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : "";

    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid incident ID" });
      return;
    }

    const updated = await incidentsRepo.acknowledgeIncident(id);
    if (!updated) {
      // Check if it exists in another state or absent
      const existing = await incidentsRepo.getIncidentById(id);
      if (!existing) {
        res.status(404).json({ error: `Incident with ID '${id}' not found` });
        return;
      }
      res.status(400).json({
        error: `Cannot acknowledge incident currently in '${existing.status}' status (must be 'OPEN')`,
      });
      return;
    }

    res.status(200).json(updated);
  } catch (error: unknown) {
    console.error("[Controller] acknowledgeIncidentHandler failed:", error);
    res.status(500).json({ error: "Failed to acknowledge incident" });
  }
}

export async function resolveIncidentHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : "";

    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid incident ID" });
      return;
    }

    const updated = await incidentsRepo.resolveIncident(id);
    if (!updated) {
      const existing = await incidentsRepo.getIncidentById(id);
      if (!existing) {
        res.status(404).json({ error: `Incident with ID '${id}' not found` });
        return;
      }
      res.status(400).json({
        error: `Cannot resolve incident currently in '${existing.status}' status (must be 'OPEN' or 'ACKNOWLEDGED')`,
      });
      return;
    }

    res.status(200).json(updated);
  } catch (error: unknown) {
    console.error("[Controller] resolveIncidentHandler failed:", error);
    res.status(500).json({ error: "Failed to resolve incident" });
  }
}
