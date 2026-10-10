import { Request, Response } from "express";
import {
  ConflictError,
  createService,
  deleteService,
  getServiceById,
  listServices,
  updateService,
} from "../services/service-registry";
import {
  CreateServiceInput,
  ServiceEnvironment,
  UpdateServiceInput,
} from "../types/service.types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_ENVIRONMENTS: readonly ServiceEnvironment[] = [
  "development",
  "staging",
  "production",
];

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidEnvironment(value: unknown): value is ServiceEnvironment {
  return (
    typeof value === "string" &&
    (ALLOWED_ENVIRONMENTS as readonly string[]).includes(value)
  );
}

export function isValidPath(value: string): boolean {
  return typeof value === "string" && value.startsWith("/") && value.trim().length > 0;
}

export function isValidPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export async function createServiceHandler(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const errors: string[] = [];

    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "Request body must be a JSON object" });
      return;
    }

    const name = body.name;
    const baseUrl = body.baseUrl ?? body.base_url;
    const healthCheckPath = body.healthCheckPath ?? body.health_check_path;
    const environment = body.environment;
    const checkIntervalSeconds =
      body.checkIntervalSeconds ?? body.check_interval_seconds;
    const timeoutMs = body.timeoutMs ?? body.timeout_ms;
    const isEnabled = body.isEnabled ?? body.is_enabled;

    if (typeof name !== "string" || name.trim().length === 0) {
      errors.push("Field 'name' is required and must be a non-empty string");
    } else if (name.trim().length > 255) {
      errors.push("Field 'name' cannot exceed 255 characters");
    }

    if (typeof baseUrl !== "string" || !isValidUrl(baseUrl)) {
      errors.push("Field 'baseUrl' is required and must be a valid HTTP or HTTPS URL");
    }

    if (healthCheckPath !== undefined) {
      if (typeof healthCheckPath !== "string" || !isValidPath(healthCheckPath)) {
        errors.push("Field 'healthCheckPath' must be a valid path starting with '/'");
      }
    }

    if (!isValidEnvironment(environment)) {
      errors.push(
        `Field 'environment' must be one of: ${ALLOWED_ENVIRONMENTS.join(", ")}`
      );
    }

    if (checkIntervalSeconds !== undefined && !isValidPositiveInteger(checkIntervalSeconds)) {
      errors.push("Field 'checkIntervalSeconds' must be a positive integer");
    }

    if (timeoutMs !== undefined && !isValidPositiveInteger(timeoutMs)) {
      errors.push("Field 'timeoutMs' must be a positive integer");
    }

    if (isEnabled !== undefined && typeof isEnabled !== "boolean") {
      errors.push("Field 'isEnabled' must be a boolean");
    }

    if (errors.length > 0) {
      res.status(400).json({ error: "Validation failed", details: errors });
      return;
    }

    const input: CreateServiceInput = {
      name: (name as string).trim(),
      baseUrl: baseUrl as string,
      healthCheckPath: healthCheckPath as string | undefined,
      environment: environment as ServiceEnvironment,
      checkIntervalSeconds: checkIntervalSeconds as number | undefined,
      timeoutMs: timeoutMs as number | undefined,
      isEnabled: isEnabled as boolean | undefined,
    };

    const created = await createService(input);
    res.status(201).json(created);
  } catch (error: unknown) {
    if (error instanceof ConflictError) {
      res.status(409).json({ error: "Conflict", message: error.message });
      return;
    }
    console.error("[Controller] createServiceHandler failed:", error);
    res.status(500).json({ error: "Failed to create service" });
  }
}

export async function listServicesHandler(req: Request, res: Response): Promise<void> {
  try {
    const envQuery = req.query.environment as string | undefined;
    const enabledQuery = req.query.isEnabled as string | undefined;

    const filter: { environment?: string; isEnabled?: boolean } = {};
    if (envQuery && isValidEnvironment(envQuery)) {
      filter.environment = envQuery;
    }
    if (enabledQuery !== undefined) {
      filter.isEnabled = enabledQuery === "true";
    }

    const services = await listServices(filter);
    res.status(200).json(services);
  } catch (error: unknown) {
    console.error("[Controller] listServicesHandler failed:", error);
    res.status(500).json({ error: "Failed to list services" });
  }
}

export async function getServiceByIdHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : "";

    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid service ID. Must be a valid UUID" });
      return;
    }

    const service = await getServiceById(id);

    if (!service) {
      res.status(404).json({ error: `Service with ID '${id}' not found` });
      return;
    }

    res.status(200).json(service);
  } catch (error: unknown) {
    console.error("[Controller] getServiceByIdHandler failed:", error);
    res.status(500).json({ error: "Failed to retrieve service" });
  }
}

export async function updateServiceHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : "";

    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid service ID. Must be a valid UUID" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "Request body must be a JSON object" });
      return;
    }

    const errors: string[] = [];
    const updateInput: UpdateServiceInput = {};
    let fieldsProvided = 0;

    const name = body.name;
    const baseUrl = body.baseUrl ?? body.base_url;
    const healthCheckPath = body.healthCheckPath ?? body.health_check_path;
    const environment = body.environment;
    const checkIntervalSeconds =
      body.checkIntervalSeconds ?? body.check_interval_seconds;
    const timeoutMs = body.timeoutMs ?? body.timeout_ms;
    const isEnabled = body.isEnabled ?? body.is_enabled;

    if (name !== undefined) {
      fieldsProvided++;
      if (typeof name !== "string" || name.trim().length === 0) {
        errors.push("Field 'name' must be a non-empty string");
      } else if (name.trim().length > 255) {
        errors.push("Field 'name' cannot exceed 255 characters");
      } else {
        updateInput.name = name.trim();
      }
    }

    if (baseUrl !== undefined) {
      fieldsProvided++;
      if (typeof baseUrl !== "string" || !isValidUrl(baseUrl)) {
        errors.push("Field 'baseUrl' must be a valid HTTP or HTTPS URL");
      } else {
        updateInput.baseUrl = baseUrl;
      }
    }

    if (healthCheckPath !== undefined) {
      fieldsProvided++;
      if (typeof healthCheckPath !== "string" || !isValidPath(healthCheckPath)) {
        errors.push("Field 'healthCheckPath' must be a valid path starting with '/'");
      } else {
        updateInput.healthCheckPath = healthCheckPath;
      }
    }

    if (environment !== undefined) {
      fieldsProvided++;
      if (!isValidEnvironment(environment)) {
        errors.push(
          `Field 'environment' must be one of: ${ALLOWED_ENVIRONMENTS.join(", ")}`
        );
      } else {
        updateInput.environment = environment;
      }
    }

    if (checkIntervalSeconds !== undefined) {
      fieldsProvided++;
      if (!isValidPositiveInteger(checkIntervalSeconds)) {
        errors.push("Field 'checkIntervalSeconds' must be a positive integer");
      } else {
        updateInput.checkIntervalSeconds = checkIntervalSeconds;
      }
    }

    if (timeoutMs !== undefined) {
      fieldsProvided++;
      if (!isValidPositiveInteger(timeoutMs)) {
        errors.push("Field 'timeoutMs' must be a positive integer");
      } else {
        updateInput.timeoutMs = timeoutMs;
      }
    }

    if (isEnabled !== undefined) {
      fieldsProvided++;
      if (typeof isEnabled !== "boolean") {
        errors.push("Field 'isEnabled' must be a boolean");
      } else {
        updateInput.isEnabled = isEnabled;
      }
    }

    if (fieldsProvided === 0) {
      res.status(400).json({ error: "At least one update field must be provided" });
      return;
    }

    if (errors.length > 0) {
      res.status(400).json({ error: "Validation failed", details: errors });
      return;
    }

    const updated = await updateService(id, updateInput);

    if (!updated) {
      res.status(404).json({ error: `Service with ID '${id}' not found` });
      return;
    }

    res.status(200).json(updated);
  } catch (error: unknown) {
    if (error instanceof ConflictError) {
      res.status(409).json({ error: "Conflict", message: error.message });
      return;
    }
    console.error("[Controller] updateServiceHandler failed:", error);
    res.status(500).json({ error: "Failed to update service" });
  }
}

export async function deleteServiceHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : "";

    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid service ID. Must be a valid UUID" });
      return;
    }

    const deleted = await deleteService(id);

    if (!deleted) {
      res.status(404).json({ error: `Service with ID '${id}' not found` });
      return;
    }

    res.status(204).send();
  } catch (error: unknown) {
    console.error("[Controller] deleteServiceHandler failed:", error);
    res.status(500).json({ error: "Failed to delete service" });
  }
}
