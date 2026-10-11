import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  X,
  Activity,
  Search,
  Server,
  CheckCircle2,
  PowerOff,
  Copy,
  Check,
  AlertOctagon,
} from 'lucide-react';
import type { CreateServiceInput, HealthCheckResult, ServiceEnvironment, ServiceRecord } from '../types';
import { getCheckError } from '../types';
import styles from './ServicesView.module.css';

interface ServicesViewProps {
  services: ServiceRecord[];
  latestChecks?: Record<string, HealthCheckResult | null>;
  onCreateService: (input: CreateServiceInput) => Promise<void>;
  onUpdateService: (id: string, input: Partial<CreateServiceInput>) => Promise<void>;
  onDeleteService: (id: string) => Promise<void>;
  onInspectTelemetry: (serviceId: string) => void;
  isLoading: boolean;
}

export const ServicesView: React.FC<ServicesViewProps> = ({
  services,
  latestChecks = {},
  onCreateService,
  onUpdateService,
  onDeleteService,
  onInspectTelemetry,
  isLoading,
}) => {
  const [selectedEnv, setSelectedEnv] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedEndpointId, setCopiedEndpointId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [healthCheckPath, setHealthCheckPath] = useState('/health');
  const [environment, setEnvironment] = useState<ServiceEnvironment>('production');
  const [checkInterval, setCheckInterval] = useState(60);
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [isEnabled, setIsEnabled] = useState(true);

  function openCreateDrawer() {
    setEditingService(null);
    setName('');
    setBaseUrl('');
    setHealthCheckPath('/health');
    setEnvironment('production');
    setCheckInterval(60);
    setTimeoutMs(5000);
    setIsEnabled(true);
    setFormError(null);
    setIsDrawerOpen(true);
  }

  function openEditDrawer(svc: ServiceRecord) {
    setEditingService(svc);
    setName(svc.name);
    setBaseUrl(svc.baseUrl);
    setHealthCheckPath(svc.healthCheckPath);
    setEnvironment(svc.environment);
    setCheckInterval(svc.checkIntervalSeconds);
    setTimeoutMs(svc.timeoutMs);
    setIsEnabled(svc.isEnabled);
    setFormError(null);
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    setEditingService(null);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Service name is required');
      return;
    }
    if (!baseUrl.trim().startsWith('http://') && !baseUrl.trim().startsWith('https://')) {
      setFormError('Base URL must start with http:// or https://');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingService) {
        await onUpdateService(editingService.id, {
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          healthCheckPath: healthCheckPath.trim() || '/health',
          environment,
          checkIntervalSeconds: checkInterval,
          timeoutMs,
          isEnabled,
        });
      } else {
        await onCreateService({
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          healthCheckPath: healthCheckPath.trim() || '/health',
          environment,
          checkIntervalSeconds: checkInterval,
          timeoutMs,
          isEnabled,
        });
      }
      closeDrawer();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteConfirmed(id: string) {
    try {
      await onDeleteService(id);
      setDeleteConfirmId(null);
    } catch {
      // Toast handles error feedback
    }
  }

  const summaryCounts = useMemo(() => {
    const total = services.length;
    const passing = services.filter(
      (s) => s.isEnabled && latestChecks[s.id]?.isSuccess !== false
    ).length;
    const failing = services.filter(
      (s) => s.isEnabled && latestChecks[s.id]?.isSuccess === false
    ).length;
    const paused = services.filter((s) => !s.isEnabled).length;
    return { total, passing, failing, paused };
  }, [services, latestChecks]);

  const filteredServices = useMemo(() => {
    return services.filter((svc) => {
      const matchesEnv = selectedEnv === 'all' || svc.environment === selectedEnv;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && svc.isEnabled) ||
        (statusFilter === 'paused' && !svc.isEnabled);
      const matchesQuery =
        svc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        svc.baseUrl.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesEnv && matchesStatus && matchesQuery;
    });
  }, [services, selectedEnv, statusFilter, searchQuery]);

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Service Registry</h1>
          <p className={styles.pageSubtitle}>
            Configure monitored endpoints, probe cadences, and operational SLAs.
          </p>
        </div>

        <button className={styles.primaryBtn} onClick={openCreateDrawer}>
          <Plus size={16} />
          <span>Register Service</span>
        </button>
      </div>

      {/* Operational Summary Indicators Strip */}
      <div className={styles.summaryStrip}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Services</span>
          <span className={styles.summaryVal}>{summaryCounts.total}</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Passing Probes</span>
          <span className={`${styles.summaryVal} ${styles.summaryUp}`}>
            {summaryCounts.passing}
          </span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Failing / Degraded</span>
          <span className={`${styles.summaryVal} ${summaryCounts.failing > 0 ? styles.summaryDown : ''}`}>
            {summaryCounts.failing}
          </span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Probing Paused</span>
          <span className={`${styles.summaryVal} ${summaryCounts.paused > 0 ? styles.summaryMuted : ''}`}>
            {summaryCounts.paused}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={styles.controlsBar}>
        <div className={styles.filterGroup}>
          <div className={styles.envTabs} role="tablist" aria-label="Filter by Environment">
            <button
              className={`${styles.tabBtn} ${selectedEnv === 'all' ? styles.tabBtnActive : ''}`}
              onClick={() => setSelectedEnv('all')}
              role="tab"
              aria-selected={selectedEnv === 'all'}
            >
              All ({services.length})
            </button>
            <button
              className={`${styles.tabBtn} ${selectedEnv === 'production' ? styles.tabBtnActive : ''}`}
              onClick={() => setSelectedEnv('production')}
              role="tab"
              aria-selected={selectedEnv === 'production'}
            >
              Production ({services.filter((s) => s.environment === 'production').length})
            </button>
            <button
              className={`${styles.tabBtn} ${selectedEnv === 'staging' ? styles.tabBtnActive : ''}`}
              onClick={() => setSelectedEnv('staging')}
              role="tab"
              aria-selected={selectedEnv === 'staging'}
            >
              Staging ({services.filter((s) => s.environment === 'staging').length})
            </button>
            <button
              className={`${styles.tabBtn} ${selectedEnv === 'development' ? styles.tabBtnActive : ''}`}
              onClick={() => setSelectedEnv('development')}
              role="tab"
              aria-selected={selectedEnv === 'development'}
            >
              Development ({services.filter((s) => s.environment === 'development').length})
            </button>
          </div>

          <div className={styles.statusChips} role="group" aria-label="Filter by Status">
            <button
              className={`${styles.chipBtn} ${statusFilter === 'all' ? styles.chipBtnActive : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All States
            </button>
            <button
              className={`${styles.chipBtn} ${statusFilter === 'active' ? styles.chipBtnActive : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              Active Only
            </button>
            <button
              className={`${styles.chipBtn} ${statusFilter === 'paused' ? styles.chipBtnActive : ''}`}
              onClick={() => setStatusFilter('paused')}
            >
              Paused Only
            </button>
          </div>
        </div>

        <div className={styles.searchCountGroup}>
          <span className={styles.serviceCount}>
            Showing <strong>{filteredServices.length}</strong> of {services.length} services
          </span>
          <div className={styles.searchWrapper}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search service name or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search monitored services"
            />
          </div>
        </div>
      </div>

      {/* Main Operational Table */}
      <section className={styles.tableSection} aria-label="Services List">
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <colgroup>
              <col style={{ width: '22%', minWidth: '140px' }} />
              <col style={{ width: '13%', minWidth: '95px' }} />
              <col style={{ width: '31%', minWidth: '170px' }} />
              <col style={{ width: '15%', minWidth: '120px' }} />
              <col style={{ width: '10%', minWidth: '85px' }} />
              <col style={{ width: '9%', minWidth: '100px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className={styles.th}>Service Name</th>
                <th className={styles.th}>Environment</th>
                <th className={styles.th}>Health Check Target</th>
                <th className={styles.th}>Cadence & Timeout</th>
                <th className={styles.th}>Probing State</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1, 2, 3, 4].map((n) => (
                  <tr key={n} className={styles.tr}>
                    <td className={styles.td}>
                      <div className="cp-skeleton" style={{ height: 16, width: 160 }} />
                    </td>
                    <td className={styles.td}>
                      <div className="cp-skeleton" style={{ height: 16, width: 70 }} />
                    </td>
                    <td className={styles.td}>
                      <div className="cp-skeleton" style={{ height: 16, width: 220 }} />
                    </td>
                    <td className={styles.td}>
                      <div className="cp-skeleton" style={{ height: 16, width: 100 }} />
                    </td>
                    <td className={styles.td}>
                      <div className="cp-skeleton" style={{ height: 16, width: 60 }} />
                    </td>
                    <td className={styles.td} style={{ textAlign: 'right' }}>
                      <div className="cp-skeleton" style={{ height: 30, width: 90, marginLeft: 'auto' }} />
                    </td>
                  </tr>
                ))
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyTable}>
                    <div className={styles.emptyContainer}>
                      <Server size={32} style={{ color: 'var(--cp-text-muted)' }} />
                      <span className={styles.emptyTitle}>
                        {searchQuery ? 'No services match your search query.' : 'No services configured.'}
                      </span>
                      <span className={styles.emptySub}>
                        Register an endpoint to begin automated health checks and metrics collection.
                      </span>
                      <button className={styles.primaryBtn} onClick={openCreateDrawer} style={{ marginTop: 8 }}>
                        <Plus size={15} /> Register Service
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredServices.map((svc) => {
                  const fullEndpoint = `${svc.baseUrl}${svc.healthCheckPath}`;
                  const isCopied = copiedEndpointId === svc.id;

                  return (
                    <tr key={svc.id} className={styles.tr}>
                      <td className={`${styles.td} ${styles.tdPrimary}`}>
                        <button
                          className={styles.svcNameBtn}
                          onClick={() => onInspectTelemetry(svc.id)}
                          title="View diagnostic telemetry"
                        >
                          {svc.name}
                        </button>
                      </td>
                      <td className={styles.td}>
                        <span
                          className={`${styles.envTag} ${
                            svc.environment === 'production'
                              ? styles.envProd
                              : svc.environment === 'staging'
                              ? styles.envStaging
                              : styles.envDev
                          }`}
                        >
                          {svc.environment}
                        </span>
                      </td>
                      <td className={`${styles.td} ${styles.tdMono}`}>
                        <div className={styles.endpointCell}>
                          <span
                            className={styles.endpointText}
                            title={`${fullEndpoint} (Click copy button to copy)`}
                          >
                            {fullEndpoint}
                          </span>
                          <button
                            className={styles.copyBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(fullEndpoint);
                              setCopiedEndpointId(svc.id);
                              setTimeout(() => setCopiedEndpointId(null), 2000);
                            }}
                            title={isCopied ? 'Copied to clipboard!' : 'Copy full endpoint URL'}
                            aria-label="Copy endpoint URL"
                          >
                            {isCopied ? (
                              <Check size={11} className={styles.copySuccess} />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className={`${styles.td} ${styles.tdMono}`}>
                        <span className={styles.cadencePill}>
                          {svc.checkIntervalSeconds}s cadence · {svc.timeoutMs}ms limit
                        </span>
                      </td>
                      <td className={styles.td}>
                        {svc.isEnabled ? (
                          latestChecks?.[svc.id]?.isSuccess === false ? (
                            <span
                              className={styles.failingPill}
                              title={getCheckError(latestChecks[svc.id]) || 'Probe Failing'}
                            >
                              <AlertOctagon size={13} /> Failing
                            </span>
                          ) : (
                            <span className={styles.activePill}>
                              <CheckCircle2 size={13} /> Active
                            </span>
                          )
                        ) : (
                          <span className={styles.pausedPill}>
                            <PowerOff size={13} /> Paused
                          </span>
                        )}
                      </td>
                      <td className={styles.td}>
                        <div className={styles.actionCell}>
                          <button
                            className={styles.iconBtn}
                            onClick={() => onInspectTelemetry(svc.id)}
                            title="Inspect Telemetry & Metrics"
                            aria-label={`Inspect Telemetry for ${svc.name}`}
                          >
                            <Activity size={14} />
                          </button>
                          <button
                            className={styles.iconBtn}
                            onClick={() => openEditDrawer(svc)}
                            title="Edit Service Settings"
                            aria-label={`Edit ${svc.name}`}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                            onClick={() => setDeleteConfirmId(svc.id)}
                            title="Delete Service"
                            aria-label={`Delete ${svc.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className={styles.modalOverlay} onClick={() => setDeleteConfirmId(null)} role="dialog" aria-modal="true">
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Delete Service</h3>
            <p className={styles.modalBody}>
              Are you sure you want to remove this service from monitoring? All associated historical check logs and alert rules will be deregistered.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
              <button
                className={styles.deleteConfirmBtn}
                onClick={() => handleDeleteConfirmed(deleteConfirmId)}
              >
                Delete Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Registration & Edit Drawer */}
      {isDrawerOpen && (
        <div className={styles.drawerOverlay} onClick={closeDrawer} role="dialog" aria-modal="true">
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h3 className={styles.drawerTitle}>
                {editingService ? `Edit Service: ${editingService.name}` : 'Register New Monitored Service'}
              </h3>
              <button className={styles.closeBtn} onClick={closeDrawer} aria-label="Close drawer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.drawerForm}>
              <div className={styles.drawerBody}>
                {formError && (
                  <div className={styles.errorBanner}>{formError}</div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.label}>Service Display Name *</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="e.g. Authentication Service"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Base URL *</label>
                  <input
                    type="url"
                    className={styles.input}
                    placeholder="https://api.example.com"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    required
                  />
                  <span className={styles.helperText}>Must include http:// or https:// prefix</span>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Health Check Endpoint Path</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="/health"
                    value={healthCheckPath}
                    onChange={(e) => setHealthCheckPath(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Environment Scope *</label>
                  <select
                    className={styles.select}
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value as ServiceEnvironment)}
                  >
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Interval (seconds)</label>
                    <input
                      type="number"
                      className={styles.input}
                      min={5}
                      max={86400}
                      value={checkInterval}
                      onChange={(e) => setCheckInterval(Number(e.target.value))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Timeout (ms)</label>
                    <input
                      type="number"
                      className={styles.input}
                      min={100}
                      max={60000}
                      value={timeoutMs}
                      onChange={(e) => setTimeoutMs(Number(e.target.value))}
                    />
                  </div>
                </div>

                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                  />
                  <span className={styles.checkboxLabel}>Enable active background probing</span>
                </label>
              </div>

              <div className={styles.drawerFooter}>
                <button type="button" className={styles.cancelBtn} onClick={closeDrawer}>
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingService ? 'Save Changes' : 'Register Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
