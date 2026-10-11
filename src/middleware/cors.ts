import { NextFunction, Request, Response } from "express";
import { config } from "../config";

/**
 * Determines whether the incoming request origin is permitted by CORS policy.
 */
export function isOriginAllowed(
  origin: string,
  configuredOrigins: string[],
  nodeEnv: string
): boolean {
  if (!origin) return false;

  // Wildcard allow all
  if (configuredOrigins.includes("*") || configuredOrigins.length === 0) {
    return true;
  }

  const lowerOrigin = origin.toLowerCase().trim();
  for (const allowed of configuredOrigins) {
    const lowerAllowed = allowed.toLowerCase().trim();
    if (lowerAllowed === lowerOrigin || lowerAllowed === "*") {
      return true;
    }
    // Subdomain wildcard matching (e.g. *.vercel.app or https://*.vercel.app)
    if (lowerAllowed.includes("*")) {
      const regexStr = "^" + lowerAllowed.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$";
      if (new RegExp(regexStr).test(lowerOrigin)) {
        return true;
      }
    }
  }

  // Development defaults
  if (nodeEnv !== "production") {
    if (
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:")
    ) {
      return true;
    }
  }

  // Preview deployments on Vercel
  try {
    const url = new URL(origin);
    if (url.hostname.endsWith(".vercel.app") || url.hostname === "vercel.app") {
      return true;
    }
  } catch {
    // ignore URL parsing error
  }

  return false;
}

/**
 * CORS middleware supporting explicit allowed origins, wildcard subdomains, and secure preflight handling.
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const configuredOrigins = config.cors.allowedOrigins;

  const allowOrigin = origin ? isOriginAllowed(origin, configuredOrigins, config.nodeEnv) : false;

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
    "Authorization, X-API-Key, Content-Type, Accept, Origin, ngrok-skip-browser-warning"
  );
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
}
