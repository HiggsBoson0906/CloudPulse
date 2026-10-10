import express, { Express } from "express";
import healthRouter from "./routes/health.routes";
import servicesRouter from "./routes/services.routes";

function createApp(): Express {
  const app: Express = express();

  app.use(express.json());
  app.use(healthRouter);
  app.use(servicesRouter);

  return app;
}

const app = createApp();

export default app;
