import { Router } from "express";
import {
  getDashboardSummaryHandler,
  getServiceChecksHandler,
  getServiceMetricsHandler,
} from "../controllers/metrics.controller";

const router = Router();

router.get("/services/:id/metrics", getServiceMetricsHandler);
router.get("/services/:id/checks", getServiceChecksHandler);
router.get("/dashboard/summary", getDashboardSummaryHandler);

export default router;
