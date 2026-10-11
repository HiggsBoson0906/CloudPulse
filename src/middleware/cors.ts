import { NextFunction, Request, Response } from "express";
import { config } from "../config";

/**
 * CORS middleware supporting explicit allowed origins and secure preflight handling.
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const configuredOrigins = config.cors.allowedOrigins;

  let allowOrigin = false;

  if (origin) {
    if (configuredOrigins.length === 0) {
      // In development, permit localhost / 127.0.0.1 Vite dev servers
      if (config.nodeEnv !== "production") {
        if (
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:")
        ) {
          allowOrigin = true;
        }
      }
    } else if (configuredOrigins.includes(origin.toLowerCase()) || configuredOrigins.includes("*")) {
      allowOrigin = true;
    }
  }

  if (allowOrigin && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, X-API-Key, Content-Type, Accept, Origin"
  );
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
}
