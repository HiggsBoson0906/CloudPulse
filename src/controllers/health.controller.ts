import { Request, Response } from "express";

export function getHealth(_req: Request, res: Response): void {
  const serviceName = process.env.SERVICE_NAME || "cloudpulse";

  res.status(200).json({
    status: "ok",
    service: serviceName,
  });
}
