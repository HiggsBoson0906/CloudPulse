import { Router } from "express";
import {
  acknowledgeIncidentHandler,
  getIncidentByIdHandler,
  listIncidentsHandler,
  resolveIncidentHandler,
} from "../controllers/incidents.controller";
import { requireOperator, requireViewer } from "../middleware/auth.middleware";

const router = Router();

// Viewer: read incidents
router.get("/incidents", requireViewer, listIncidentsHandler);
router.get("/incidents/:id", requireViewer, getIncidentByIdHandler);

// Operator/Admin: acknowledge and resolve incidents
router.post("/incidents/:id/acknowledge", requireOperator, acknowledgeIncidentHandler);
router.post("/incidents/:id/resolve", requireOperator, resolveIncidentHandler);

export default router;
