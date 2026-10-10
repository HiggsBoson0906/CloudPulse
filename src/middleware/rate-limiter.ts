import { Request, Response, NextFunction } from "express";
import { cacheService } from "../redis/cache.service";

export interface RateLimitOptions {
  limit?: number; // max requests
  windowSeconds?: number; // per window seconds
}

export function createRateLimiter(options: RateLimitOptions = {}) {
  const limit = options.limit ?? 120; // 120 requests
  const windowSeconds = options.windowSeconds ?? 60; // per minute

  return async function rateLimiterMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const result = await cacheService.checkRateLimit(`ip:${clientIp}`, limit, windowSeconds);

    res.setHeader("X-RateLimit-Limit", limit.toString());
    res.setHeader("X-RateLimit-Remaining", result.remaining.toString());

    if (!result.allowed) {
      res.status(429).json({
        error: "Too Many Requests",
        message: "API rate limit exceeded. Please retry after some time.",
      });
      return;
    }

    next();
  };
}
