import express, { Express } from "express";
import healthRouter from "./routes/health.routes";
import servicesRouter from "./routes/services.routes";
import metricsRouter from "./routes/metrics.routes";
import alertsRouter from "./routes/alerts.routes";
import incidentsRouter from "./routes/incidents.routes";
import { requestLogger } from "./middleware/request-logger";
import { createRateLimiter } from "./middleware/rate-limiter";
import { errorHandler } from "./middleware/error.middleware";

export function createApp(): Express {
  const app: Express = express();

  app.use(express.json());
  app.use(requestLogger);
  app.use(createRateLimiter({ limit: 300, windowSeconds: 60 }));

  // Mount API Routers
  app.use(healthRouter);
  app.use(servicesRouter);
  app.use(metricsRouter);
  app.use(alertsRouter);
  app.use(incidentsRouter);

  // Global error handler
  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;
