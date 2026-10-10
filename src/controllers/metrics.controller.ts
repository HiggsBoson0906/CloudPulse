import { Request, Response } from "express";
import { isValidUUID } from "./services.controller";
import { getDashboardSummary, getRecentServiceChecks, getServiceMetrics } from "../services/metrics.service";
import { getServiceById } from "../services/service-registry";
import { MetricWindow } from "../types/metric.types";

const VALID_WINDOWS: readonly MetricWindow[] = ["15m", "1h", "24h"];

export async function getServiceMetricsHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : "";

    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid service ID. Must be a valid UUID" });
      return;
    }

    const service = await getServiceById(id);
    if (!service) {
      res.status(404).json({ error: `Service with ID '${id}' not found` });
      return;
    }

    const windowQuery = (req.query.window as MetricWindow) || "15m";
    if (!VALID_WINDOWS.includes(windowQuery)) {
      res.status(400).json({
        error: `Invalid window '${windowQuery}'. Must be one of: ${VALID_WINDOWS.join(", ")}`,
      });
      return;
    }

    const metrics = await getServiceMetrics(id, windowQuery);
    res.status(200).json(metrics);
  } catch (error: unknown) {
    console.error("[Controller] getServiceMetricsHandler failed:", error);
    res.status(500).json({ error: "Failed to retrieve metrics" });
  }
}

export async function getServiceChecksHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : "";

    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid service ID. Must be a valid UUID" });
      return;
    }

    const service = await getServiceById(id);
    if (!service) {
      res.status(404).json({ error: `Service with ID '${id}' not found` });
      return;
    }

    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? 50 : limitParam), 200);

    const checks = await getRecentServiceChecks(id, limit);
    res.status(200).json(checks);
  } catch (error: unknown) {
    console.error("[Controller] getServiceChecksHandler failed:", error);
    res.status(500).json({ error: "Failed to retrieve check history" });
  }
}

export async function getDashboardSummaryHandler(_req: Request, res: Response): Promise<void> {
  try {
    const summary = await getDashboardSummary();
    res.status(200).json(summary);
  } catch (error: unknown) {
    console.error("[Controller] getDashboardSummaryHandler failed:", error);
    res.status(500).json({ error: "Failed to retrieve dashboard summary" });
  }
}
