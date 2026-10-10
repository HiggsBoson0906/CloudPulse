import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  X,
  Activity,
} from 'lucide-react';
import type { CreateServiceInput, ServiceEnvironment, ServiceRecord } from '../types';
import styles from './ServicesView.module.css';

interface ServicesViewProps {
  services: ServiceRecord[];
  onCreateService: (input: CreateServiceInput) => Promise<void>;
  onUpdateService: (id: string, input: Partial<CreateServiceInput>) => Promise<void>;
  onDeleteService: (id: string) => Promise<void>;
  onInspectTelemetry: (serviceId: string) => void;
  isLoading: boolean;
}

export const ServicesView: React.FC<ServicesViewProps> = ({
  services,
  onCreateService,
  onUpdateService,
  onDeleteService,
  onInspectTelemetry,
  isLoading,
}) => {
  const [selectedEnv, setSelectedEnv] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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

  const filteredServices = services.filter((svc) => {
    const matchesEnv = selectedEnv === 'all' || svc.environment === selectedEnv;
    const matchesQuery =
      svc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      svc.baseUrl.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesEnv && matchesQuery;
  });

  return (
    <div className={styles.container}>
      <div className={styles.controlsBar}>
        <div className={styles.leftControls}>
          <div className={styles.envTabs}>
            <button
              className={`${styles.tabBtn} ${selectedEnv === 'all' ? styles.tabBtnActive : ''}`}
              onClick={() => setSelectedEnv('all')}
            >
              All Environments
            </button>
            <button
              className={`${styles.tabBtn} ${selectedEnv === 'production' ? styles.tabBtnActive : ''}`}
              onClick={() => setSelectedEnv('production')}
            >
              Production
            </button>
            <button
              className={`${styles.tabBtn} ${selectedEnv === 'staging' ? styles.tabBtnActive : ''}`}
              onClick={() => setSelectedEnv('staging')}
            >
              Staging
            </button>
            <button
              className={`${styles.tabBtn} ${selectedEnv === 'development' ? styles.tabBtnActive : ''}`}
              onClick={() => setSelectedEnv('development')}
            >
              Development
            </button>
          </div>

          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search services or endpoints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button className={styles.primaryBtn} onClick={openCreateDrawer}>
          <Plus size={16} />
          Register Service
        </button>
      </div>

      <section className={styles.tableSection}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Service Name</th>
                <th className={styles.th}>Environment</th>
                <th className={styles.th}>Target URL</th>
                <th className={styles.th}>Interval / Timeout</th>
                <th className={styles.th}>Enabled</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  {[1, 2, 3, 4].map((n) => (
                    <tr key={n} className={styles.tr}>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: '16px', width: '150px' }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: '16px', width: '70px' }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: '16px', width: '200px' }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: '16px', width: '90px' }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: '16px', width: '50px' }} />
                      </td>
                      <td className={styles.td} style={{ textAlign: 'right' }}>
                        <div className="cp-skeleton" style={{ height: '28px', width: '80px', marginLeft: 'auto' }} />
                      </td>
                    </tr>
                  ))}
                </>
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--cp-text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Activity size={24} style={{ color: 'var(--cp-text-muted)' }} />
                      <span>No services found matching the current filters.</span>
                      <button
                        className={styles.primaryBtn}
                        onClick={openCreateDrawer}
                        style={{ marginTop: '6px' }}
                      >
                        <Plus size={14} /> Register New Service
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredServices.map((svc) => (
                  <tr key={svc.id} className={styles.tr}>
                    <td className={`${styles.td} ${styles.tdPrimary}`}>
                      {svc.name}
                    </td>
                    <td className={styles.td}>
                      <span className="mono" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                        {svc.environment}
                      </span>
                    </td>
                    <td className={`${styles.td} mono`}>
                      {svc.baseUrl}{svc.healthCheckPath}
                    </td>
                    <td className={`${styles.td} mono`}>
                      {svc.checkIntervalSeconds}s / {svc.timeoutMs}ms
                    </td>
                    <td className={styles.td}>
                      {svc.isEnabled ? (
                        <span style={{ color: 'var(--cp-status-up)', fontWeight: 600 }}>Active</span>
                      ) : (
                        <span style={{ color: 'var(--cp-text-muted)' }}>Disabled</span>
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
                          onClick={() => {
                            if (window.confirm(`Delete service "${svc.name}"?`)) {
                              onDeleteService(svc.id);
                            }
                          }}
                          title="Delete Service"
                          aria-label={`Delete ${svc.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Slide-over Registration & Edit Drawer */}
      {isDrawerOpen && (
        <div className={styles.drawerOverlay} onClick={closeDrawer}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h3 className={styles.drawerTitle}>
                {editingService ? `Edit Service: ${editingService.name}` : 'Register New Service'}
              </h3>
              <button className={styles.iconBtn} onClick={closeDrawer}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className={styles.drawerBody}>
                {formError && (
                  <div className={styles.errorBanner}>{formError}</div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.label}>Service Name *</label>
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
                    placeholder="https://auth.example.com"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Health Check Path</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="/health"
                    value={healthCheckPath}
                    onChange={(e) => setHealthCheckPath(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Environment *</label>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Probe Interval (seconds)</label>
                    <input
                      type="number"
                      className={styles.input}
                      min={1}
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
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                  />
                  <span className={styles.label}>Enable Health Probing</span>
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
