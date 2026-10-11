import { NextFunction, Request, Response } from "express";

/**
 * Production security headers middleware defending against XSS, clickjacking,
 * MIME-sniffing, and insecure transport.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking via iframes
  res.setHeader("X-Frame-Options", "DENY");

  // Modern browser XSS filter disablement (relies on CSP)
  res.setHeader("X-XSS-Protection", "0");

  // Enforce HTTPS in supporting clients
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );

  // Control referrer information leakage
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Baseline Content Security Policy for API server
  res.setHeader("Content-Security-Policy", "default-src 'self'");

  // Remove Express fingerprinting header
  res.removeHeader("X-Powered-By");

  next();
}
