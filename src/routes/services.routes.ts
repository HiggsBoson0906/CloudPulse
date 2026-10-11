import { Router } from "express";
import {
  createServiceHandler,
  deleteServiceHandler,
  getServiceByIdHandler,
  listServicesHandler,
  updateServiceHandler,
} from "../controllers/services.controller";
import { requireAdmin, requireViewer } from "../middleware/auth.middleware";

const router = Router();

// Viewer: read service inventory
router.get("/services", requireViewer, listServicesHandler);
router.get("/services/:id", requireViewer, getServiceByIdHandler);

// Admin: register, update, and remove monitored services
router.post("/services", requireAdmin, createServiceHandler);
router.patch("/services/:id", requireAdmin, updateServiceHandler);
router.delete("/services/:id", requireAdmin, deleteServiceHandler);

export default router;
