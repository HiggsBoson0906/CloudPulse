import { Router } from "express";
import {
  createAlertRuleHandler,
  deleteAlertRuleHandler,
  getAlertRuleByIdHandler,
  listAlertRulesHandler,
  listAlertsHandler,
  updateAlertRuleHandler,
} from "../controllers/alerts.controller";

const router = Router();

router.post("/alert-rules", createAlertRuleHandler);
router.get("/alert-rules", listAlertRulesHandler);
router.get("/alert-rules/:id", getAlertRuleByIdHandler);
router.patch("/alert-rules/:id", updateAlertRuleHandler);
router.delete("/alert-rules/:id", deleteAlertRuleHandler);

router.get("/alerts", listAlertsHandler);

export default router;
