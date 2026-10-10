import type {
  Alert,
  AlertRule,
  CreateAlertRuleInput,
  CreateServiceInput,
  DashboardSummary,
  HealthCheckResult,
  Incident,
  MetricWindow,
  ServiceEnvironment,
  ServiceMetrics,
  ServiceRecord,
  UpdateServiceInput,
} from '../types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function getUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) {
        errorMsg = body.error;
      }
    } catch {
      // Ignore JSON parse failure on error body
    }
    throw new Error(errorMsg);
  }
  if (res.status === 204) {
    return undefined as unknown as T;
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Readiness & Health
  async getReadiness(): Promise<{
    status: string;
    service: string;
    components: { database: string; redis: string };
    timestamp: string;
  }> {
    const res = await fetch(getUrl('/ready'));
    return handleResponse(res);
  },

  // Dashboard
  async getDashboardSummary(): Promise<DashboardSummary> {
    const res = await fetch(getUrl('/dashboard/summary'));
    return handleResponse<DashboardSummary>(res);
  },

  // Services
  async getServices(environment?: ServiceEnvironment): Promise<ServiceRecord[]> {
    const path = environment ? `/services?environment=${encodeURIComponent(environment)}` : '/services';
    const res = await fetch(getUrl(path));
    return handleResponse<ServiceRecord[]>(res);
  },

  async getService(id: string): Promise<ServiceRecord> {
    const res = await fetch(getUrl(`/services/${encodeURIComponent(id)}`));
    return handleResponse<ServiceRecord>(res);
  },

  async createService(input: CreateServiceInput): Promise<ServiceRecord> {
    const res = await fetch(getUrl('/services'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse<ServiceRecord>(res);
  },

  async updateService(id: string, input: UpdateServiceInput): Promise<ServiceRecord> {
    const res = await fetch(getUrl(`/services/${encodeURIComponent(id)}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse<ServiceRecord>(res);
  },

  async deleteService(id: string): Promise<void> {
    const res = await fetch(getUrl(`/services/${encodeURIComponent(id)}`), {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  // Metrics & Checks
  async getServiceMetrics(id: string, window: MetricWindow = '15m'): Promise<ServiceMetrics> {
    const res = await fetch(getUrl(`/services/${encodeURIComponent(id)}/metrics?window=${encodeURIComponent(window)}`));
    return handleResponse<ServiceMetrics>(res);
  },

  async getServiceChecks(id: string, limit = 50): Promise<HealthCheckResult[]> {
    const res = await fetch(getUrl(`/services/${encodeURIComponent(id)}/checks?limit=${limit}`));
    return handleResponse<HealthCheckResult[]>(res);
  },

  // Alert Rules & Alerts
  async getAlertRules(serviceId?: string): Promise<AlertRule[]> {
    const path = serviceId ? `/alert-rules?serviceId=${encodeURIComponent(serviceId)}` : '/alert-rules';
    const res = await fetch(getUrl(path));
    return handleResponse<AlertRule[]>(res);
  },

  async createAlertRule(input: CreateAlertRuleInput): Promise<AlertRule> {
    const res = await fetch(getUrl('/alert-rules'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse<AlertRule>(res);
  },

  async deleteAlertRule(id: string): Promise<void> {
    const res = await fetch(getUrl(`/alert-rules/${encodeURIComponent(id)}`), {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  async getAlerts(params?: { serviceId?: string; status?: string }): Promise<Alert[]> {
    const searchParams = new URLSearchParams();
    if (params?.serviceId) searchParams.set('serviceId', params.serviceId);
    if (params?.status) searchParams.set('status', params.status);
    const qs = searchParams.toString();
    const res = await fetch(getUrl(qs ? `/alerts?${qs}` : '/alerts'));
    return handleResponse<Alert[]>(res);
  },

  // Incidents
  async getIncidents(params?: { serviceId?: string; status?: string }): Promise<Incident[]> {
    const searchParams = new URLSearchParams();
    if (params?.serviceId) searchParams.set('serviceId', params.serviceId);
    if (params?.status) searchParams.set('status', params.status);
    const qs = searchParams.toString();
    const res = await fetch(getUrl(qs ? `/incidents?${qs}` : '/incidents'));
    return handleResponse<Incident[]>(res);
  },

  async getIncident(id: string): Promise<Incident> {
    const res = await fetch(getUrl(`/incidents/${encodeURIComponent(id)}`));
    return handleResponse<Incident>(res);
  },

  async acknowledgeIncident(id: string): Promise<Incident> {
    const res = await fetch(getUrl(`/incidents/${encodeURIComponent(id)}/acknowledge`), {
      method: 'POST',
    });
    return handleResponse<Incident>(res);
  },

  async resolveIncident(id: string): Promise<Incident> {
    const res = await fetch(getUrl(`/incidents/${encodeURIComponent(id)}/resolve`), {
      method: 'POST',
    });
    return handleResponse<Incident>(res);
  },
};
