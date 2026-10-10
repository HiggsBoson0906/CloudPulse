import * as servicesRepo from "../db/repositories/services.repo";
import { cacheService } from "../redis/cache.service";
import {
  CreateServiceInput,
  ServiceRecord,
  UpdateServiceInput,
} from "../types/service.types";

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export async function createService(input: CreateServiceInput): Promise<ServiceRecord> {
  // Check for duplicate service registration in the same environment
  const existing = await servicesRepo.findByNameAndEnvironment(input.name, input.environment);
  if (existing) {
    throw new ConflictError(
      `A service with name '${input.name}' is already registered in environment '${input.environment}'`
    );
  }

  const created = await servicesRepo.createService(input);
  await cacheService.invalidateServiceCache(created.id);
  return created;
}

export async function listServices(filter?: {
  environment?: string;
  isEnabled?: boolean;
}): Promise<ServiceRecord[]> {
  return servicesRepo.listServices(filter);
}

export async function getServiceById(id: string): Promise<ServiceRecord | null> {
  return servicesRepo.getServiceById(id);
}

export async function updateService(
  id: string,
  input: UpdateServiceInput
): Promise<ServiceRecord | null> {
  if (input.name) {
    const existing = await servicesRepo.getServiceById(id);
    if (existing) {
      const targetEnv = input.environment ?? existing.environment;
      const duplicate = await servicesRepo.findByNameAndEnvironment(input.name, targetEnv);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError(
          `A service with name '${input.name}' already exists in environment '${targetEnv}'`
        );
      }
    }
  }

  const updated = await servicesRepo.updateService(id, input);
  if (updated) {
    await cacheService.invalidateServiceCache(id);
  }
  return updated;
}

export async function deleteService(id: string): Promise<boolean> {
  const deleted = await servicesRepo.deleteService(id);
  if (deleted) {
    await cacheService.invalidateServiceCache(id);
  }
  return deleted;
}
