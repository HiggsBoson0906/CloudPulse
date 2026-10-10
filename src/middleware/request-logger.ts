import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on("finish", function (): void {
    const durationMs = Date.now() - start;
    const statusCode = res.statusCode;
    const logMethod = statusCode >= 500 ? logger.error : statusCode >= 400 ? logger.warn : logger.info;
    logMethod("HTTP", `${method} ${originalUrl} -> ${statusCode} (${durationMs}ms)`);
  });

  next();
}
