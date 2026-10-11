import { Router } from "express";
import {
  createAlertRuleHandler,
  deleteAlertRuleHandler,
  getAlertRuleByIdHandler,
  listAlertRulesHandler,
  listAlertsHandler,
  updateAlertRuleHandler,
} from "../controllers/alerts.controller";
import { requireAdmin, requireViewer } from "../middleware/auth.middleware";

const router = Router();

// Viewer: read alert rules and firing alerts
router.get("/alert-rules", requireViewer, listAlertRulesHandler);
router.get("/alert-rules/:id", requireViewer, getAlertRuleByIdHandler);
router.get("/alerts", requireViewer, listAlertsHandler);

// Admin: create, update, and delete alert rules
router.post("/alert-rules", requireAdmin, createAlertRuleHandler);
router.patch("/alert-rules/:id", requireAdmin, updateAlertRuleHandler);
router.delete("/alert-rules/:id", requireAdmin, deleteAlertRuleHandler);

export default router;
