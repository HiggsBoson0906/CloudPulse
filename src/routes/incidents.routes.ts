import { Router } from "express";
import {
  acknowledgeIncidentHandler,
  getIncidentByIdHandler,
  listIncidentsHandler,
  resolveIncidentHandler,
} from "../controllers/incidents.controller";

const router = Router();

router.get("/incidents", listIncidentsHandler);
router.get("/incidents/:id", getIncidentByIdHandler);
router.post("/incidents/:id/acknowledge", acknowledgeIncidentHandler);
router.post("/incidents/:id/resolve", resolveIncidentHandler);

export default router;
