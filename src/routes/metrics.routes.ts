import { Router } from "express";
import {
  getDashboardSummaryHandler,
  getServiceChecksHandler,
  getServiceMetricsHandler,
} from "../controllers/metrics.controller";
import { requireViewer } from "../middleware/auth.middleware";

const router = Router();

// Viewer: read service metrics, checks, and aggregate dashboard summary
router.get("/services/:id/metrics", requireViewer, getServiceMetricsHandler);
router.get("/services/:id/checks", requireViewer, getServiceChecksHandler);
router.get("/dashboard/summary", requireViewer, getDashboardSummaryHandler);

export default router;
