import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { ConflictError } from "../services/service-registry";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ConflictError) {
    res.status(409).json({
      error: "Conflict",
      message: err.message,
    });
    return;
  }

  logger.error("ErrorHandler", "Unhandled error encountered:", err);

  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message,
  });
}
