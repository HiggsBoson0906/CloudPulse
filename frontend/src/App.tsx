import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import type { TabId } from './components/layout/Sidebar';
import { OverviewView } from './views/OverviewView';
import { ServicesView } from './views/ServicesView';
import { ServiceDetailView } from './views/ServiceDetailView';
import { AlertsView } from './views/AlertsView';
import { IncidentsView } from './views/IncidentsView';
import { Toast, type ToastMessage } from './components/common/Toast';
import { ApiKeyModal } from './components/common/ApiKeyModal';
import { api } from './api/client';
import { fetchLatestChecksBounded } from './utils/health-cache';
import type {
  Alert,
  AlertRule,
  CreateAlertRuleInput,
  CreateServiceInput,
  DashboardSummary,
  HealthCheckResult,
  Incident,
  ServiceRecord,
  UpdateServiceInput,
} from './types';
import appStyles from './components/layout/AppShell.module.css';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(() => Boolean(api.getApiKey()));

  // Theme Management (Dark / Light Mode)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('cloudpulse_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('cloudpulse_theme', theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Platform Telemetry State
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [latestChecks, setLatestChecks] = useState<Record<string, HealthCheckResult | null>>({});

  // Polling, Tab Visibility & Concurrency Guards
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(15); // Approved 15s default
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [isTabActive, setIsTabActive] = useState<boolean>(!document.hidden);
  const isFetchingRef = useRef<boolean>(false);

  // Toast Feedback State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Comprehensive Telemetry Polling (guards against overlapping requests)
  const fetchAllData = useCallback(async (isManual = false) => {
    if (isFetchingRef.current) {
      // Overlapping request prevented
      return;
    }
    isFetchingRef.current = true;

    try {
      if (isManual) setIsRefreshing(true);
      const [sumData, svcData, incData, altData, ruleData] = await Promise.all([
        api.getDashboardSummary().catch(() => null),
        api.getServices().catch(() => []),
        api.getIncidents().catch(() => []),
        api.getAlerts().catch(() => []),
        api.getAlertRules().catch(() => []),
      ]);

      setSummary(sumData);
      setServices(svcData);
      setIncidents(incData);
      setAlerts(altData);
      setRules(ruleData);
      setLastRefreshedAt(new Date());

      // Bounded concurrency fetch for each service's latest probe check
      if (svcData.length > 0) {
        const checksMap = await fetchLatestChecksBounded(svcData, 3);
        setLatestChecks(checksMap);
      }
    } catch (err: unknown) {
      console.error('Failed to poll platform telemetry:', err);
    } finally {
      isFetchingRef.current = false;
      if (isManual) setIsRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  // Initial Load with cleanup
  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      isFetchingRef.current = true;
      try {
        const [sumData, svcData, incData, altData, ruleData] = await Promise.all([
          api.getDashboardSummary().catch(() => null),
          api.getServices().catch(() => []),
          api.getIncidents().catch(() => []),
          api.getAlerts().catch(() => []),
          api.getAlertRules().catch(() => []),
        ]);

        if (!ignore) {
          setSummary(sumData);
          setServices(svcData);
          setIncidents(incData);
          setAlerts(altData);
          setRules(ruleData);
          setLastRefreshedAt(new Date());

          if (svcData.length > 0) {
            const checksMap = await fetchLatestChecksBounded(svcData, 3);
            if (!ignore) setLatestChecks(checksMap);
          }

          if (!ignore && !api.getApiKey()) {
            showToast('info', 'No API key configured. Click "Set API Key" in the top bar to connect.');
          }
        }
      } catch (err: unknown) {
        console.error('Failed to load initial platform telemetry:', err);
      } finally {
        isFetchingRef.current = false;
        if (!ignore) setIsLoading(false);
      }
    }

    loadInitial();
    return () => {
      ignore = true;
    };
  }, [showToast]);

  // Tab Visibility Change Listener: pauses polling when hidden, resumes immediately when visible
  useEffect(() => {
    function handleVisibilityChange() {
      const active = !document.hidden;
      setIsTabActive(active);
      if (active) {
        // Immediately refresh telemetry when returning to the tab
        fetchAllData(false);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchAllData]);

  // Polling Effect (respects interval and active tab state)
  useEffect(() => {
    if (autoRefreshInterval <= 0 || !isTabActive) return;

    const intervalId = setInterval(() => {
      fetchAllData(false);
    }, autoRefreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, isTabActive, fetchAllData]);

  // Keyboard Shortcuts (Alt+1 to Alt+4)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey) {
        if (e.key === '1') {
          setSelectedServiceId(null);
          setActiveTab('overview');
        } else if (e.key === '2') {
          setSelectedServiceId(null);
          setActiveTab('services');
        } else if (e.key === '3') {
          setSelectedServiceId(null);
          setActiveTab('alerts');
        } else if (e.key === '4') {
          setSelectedServiceId(null);
          setActiveTab('incidents');
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleAuthError(err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (
      msg.includes('Authorization') ||
      msg.includes('Authentication') ||
      msg.includes('API key') ||
      msg.includes('token')
    ) {
      setIsKeyModalOpen(true);
    }
  }

  // Service Mutations with Feedback
  async function handleCreateService(input: CreateServiceInput) {
    try {
      const created = await api.createService(input);
      showToast('success', `Service "${created.name}" registered successfully`);
      await fetchAllData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register service';
      showToast('error', msg);
      handleAuthError(err);
      throw err;
    }
  }

  async function handleUpdateService(id: string, input: UpdateServiceInput) {
    try {
      const updated = await api.updateService(id, input);
      showToast('success', `Service "${updated.name}" updated successfully`);
      await fetchAllData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update service';
      showToast('error', msg);
      handleAuthError(err);
      throw err;
    }
  }

  async function handleDeleteService(id: string) {
    try {
      await api.deleteService(id);
      showToast('info', 'Service removed from monitoring registry');
      if (selectedServiceId === id) {
        setSelectedServiceId(null);
      }
      await fetchAllData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete service';
      showToast('error', msg);
      handleAuthError(err);
      throw err;
    }
  }

  // Rule Mutations with Feedback
  async function handleCreateRule(input: CreateAlertRuleInput) {
    try {
      const rule = await api.createAlertRule(input);
      showToast('success', `Alert rule "${rule.name}" configured`);
      await fetchAllData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create alert rule';
      showToast('error', msg);
      throw err;
    }
  }

  async function handleDeleteRule(id: string) {
    try {
      await api.deleteAlertRule(id);
      showToast('info', 'Alert evaluation rule deleted');
      await fetchAllData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete alert rule';
      showToast('error', msg);
      throw err;
    }
  }

  // Incident Mutations with Feedback
  async function handleAcknowledgeIncident(id: string) {
    try {
      const inc = await api.acknowledgeIncident(id);
      showToast('info', `Incident acknowledged: "${inc.title}"`);
      await fetchAllData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to acknowledge incident';
      showToast('error', msg);
      throw err;
    }
  }

  async function handleResolveIncident(id: string) {
    try {
      const inc = await api.resolveIncident(id);
      showToast('success', `Incident resolved: "${inc.title}"`);
      await fetchAllData(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resolve incident';
      showToast('error', msg);
      throw err;
    }
  }

  const activeIncidentsCount = incidents.filter(
    (i) => i.status === 'OPEN' || i.status === 'ACKNOWLEDGED'
  ).length;
  const firingAlertsCount = alerts.filter((a) => a.status === 'firing').length;

  const enabledServices = services.filter((s) => s.isEnabled);
  const failingCount = summary?.failingServices ?? 0;
  const degradedCount = summary?.degradedServices ?? 0;
  const probeFailingCount = enabledServices.filter((s) => latestChecks[s.id]?.isSuccess === false).length;
  const hasDegradation = failingCount > 0 || degradedCount > 0 || probeFailingCount > 0;

  return (
    <div className={appStyles.container}>
      <Header
        activeIncidentsCount={activeIncidentsCount}
        hasDegradation={hasDegradation}
        autoRefreshInterval={autoRefreshInterval}
        onIntervalChange={setAutoRefreshInterval}
        onManualRefresh={() => fetchAllData(true)}
        isRefreshing={isRefreshing}
        hasApiKey={hasApiKey}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className={appStyles.body}>
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setSelectedServiceId(null);
            setActiveTab(tab);
          }}
          activeIncidentsCount={activeIncidentsCount}
          activeAlertsCount={firingAlertsCount}
        />

        <main className={appStyles.mainContent}>
          {selectedServiceId ? (
            <ServiceDetailView
              serviceId={selectedServiceId}
              services={services}
              onBack={() => setSelectedServiceId(null)}
            />
          ) : activeTab === 'overview' ? (
            <OverviewView
              summary={summary}
              services={services}
              incidents={incidents}
              alerts={alerts}
              latestChecks={latestChecks}
              onAcknowledgeIncident={handleAcknowledgeIncident}
              onResolveIncident={handleResolveIncident}
              onSelectService={(svcId) => setSelectedServiceId(svcId)}
              isLoading={isLoading}
              lastRefreshedAt={lastRefreshedAt}
              isRefreshing={isRefreshing}
            />
          ) : activeTab === 'services' ? (
            <ServicesView
              services={services}
              onCreateService={handleCreateService}
              onUpdateService={handleUpdateService}
              onDeleteService={handleDeleteService}
              onInspectTelemetry={(svcId) => setSelectedServiceId(svcId)}
              isLoading={isLoading}
            />
          ) : activeTab === 'alerts' ? (
            <AlertsView
              alerts={alerts}
              rules={rules}
              services={services}
              onCreateRule={handleCreateRule}
              onDeleteRule={handleDeleteRule}
              isLoading={isLoading}
            />
          ) : (
            <IncidentsView
              incidents={incidents}
              onAcknowledge={handleAcknowledgeIncident}
              onResolve={handleResolveIncident}
              isLoading={isLoading}
            />
          )}
        </main>
      </div>

      {/* Accessible Toast Notification System */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* API Key Configuration Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onKeySaved={(key) => {
          setHasApiKey(Boolean(key));
          showToast('success', key ? 'API key active. Refreshing telemetry...' : 'API key cleared');
          fetchAllData(true);
        }}
      />
    </div>
  );
}

export default App;
