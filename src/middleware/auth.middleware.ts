import { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import { config } from "../config";
import { AuthRole, AuthenticatedUser } from "../types/auth.types";

/**
 * Constant-time string comparison to defend against timing attacks.
 */
function secureCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extracts authentication token from Bearer header or X-API-Key header.
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string") {
    const parts = authHeader.trim().split(/\s+/);
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      return parts[1];
    }
  }

  const apiKeyHeader = req.headers["x-api-key"];
  if (typeof apiKeyHeader === "string" && apiKeyHeader.trim().length > 0) {
    return apiKeyHeader.trim();
  }

  return null;
}

/**
 * Validates token against configured keys and resolves the user's role.
 */
function resolveUser(token: string): AuthenticatedUser | null {
  const { adminKey, operatorKey, viewerKey } = config.auth;

  if (adminKey && secureCompare(token, adminKey)) {
    return { role: "admin", keyId: "admin-key", name: "Administrator" };
  }
  if (operatorKey && secureCompare(token, operatorKey)) {
    return { role: "operator", keyId: "operator-key", name: "Operator" };
  }
  if (viewerKey && secureCompare(token, viewerKey)) {
    return { role: "viewer", keyId: "viewer-key", name: "Viewer" };
  }

  return null;
}

const ROLE_HIERARCHY: Record<AuthRole, number> = {
  viewer: 1,
  operator: 2,
  admin: 3,
};

/**
 * Middleware that requires a valid API token.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: "Authentication required",
      message: "Missing Authorization header or X-API-Key",
    });
    return;
  }

  const user = resolveUser(token);
  if (!user) {
    res.status(401).json({
      error: "Authentication failed",
      message: "Invalid API key or token",
    });
    return;
  }

  req.user = user;
  next();
}

/**
 * Middleware that checks if the authenticated user possesses the minimum required role.
 */
export function requireRole(minimumRole: AuthRole) {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({
        error: "Authentication required",
        message: "Caller is not authenticated",
      });
      return;
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0;

    if (userLevel < requiredLevel) {
      res.status(403).json({
        error: "Forbidden",
        message: `Role '${req.user.role}' is not authorized to perform this operation. Required: '${minimumRole}'`,
      });
      return;
    }

    next();
  };
}

export const requireAdmin = [authenticate, requireRole("admin")];
export const requireOperator = [authenticate, requireRole("operator")];
export const requireViewer = [authenticate, requireRole("viewer")];
