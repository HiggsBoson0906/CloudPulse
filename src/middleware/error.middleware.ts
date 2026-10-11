import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { ConflictError } from "../services/service-registry";

export function errorHandler(
  err: any,
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

  // Handle express.json() parse errors gracefully with 400 Bad Request
  if (err && (err.type === "entity.parse.failed" || err.status === 400)) {
    res.status(400).json({
      error: "Bad Request",
      message: "Malformed JSON in request payload",
    });
    return;
  }

  logger.error("ErrorHandler", "Unhandled error encountered:", err);

  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message,
  });
}
