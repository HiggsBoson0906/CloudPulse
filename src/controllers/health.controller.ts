import { Request, Response } from "express";
import { query } from "../db/pool";
import { isRedisHealthy } from "../redis/client";

export function getHealth(_req: Request, res: Response): void {
  const serviceName = process.env.SERVICE_NAME || "cloudpulse";

  res.status(200).json({
    status: "ok",
    service: serviceName,
  });
}

export async function getReadiness(_req: Request, res: Response): Promise<void> {
  const serviceName = process.env.SERVICE_NAME || "cloudpulse";
  let dbStatus = "down";
  let isDbOk = false;

  try {
    await query("SELECT 1;");
    dbStatus = "up";
    isDbOk = true;
  } catch (err: unknown) {
    dbStatus = "down";
  }

  const redisStatus = isRedisHealthy() ? "up" : "degraded";

  const overallStatus = isDbOk ? "ready" : "not_ready";
  const httpStatus = isDbOk ? 200 : 503;

  res.status(httpStatus).json({
    status: overallStatus,
    service: serviceName,
    components: {
      database: dbStatus,
      redis: redisStatus,
    },
    timestamp: new Date().toISOString(),
  });
}
