import { Router } from "express";
import {
  createServiceHandler,
  deleteServiceHandler,
  getServiceByIdHandler,
  listServicesHandler,
  updateServiceHandler,
} from "../controllers/services.controller";

const router = Router();

router.post("/services", createServiceHandler);
router.get("/services", listServicesHandler);
router.get("/services/:id", getServiceByIdHandler);
router.patch("/services/:id", updateServiceHandler);
router.delete("/services/:id", deleteServiceHandler);

export default router;
