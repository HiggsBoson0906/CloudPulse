import React, { useState } from 'react';
import {
  AlertCircle,
  Plus,
  Trash2,
  X,
  BellRing,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import type {
  Alert,
  AlertRule,
  AlertRuleType,
  AlertSeverity,
  CreateAlertRuleInput,
  ServiceRecord,
} from '../types';
import styles from './AlertsView.module.css';

interface AlertsViewProps {
  alerts: Alert[];
  rules: AlertRule[];
  services: ServiceRecord[];
  onCreateRule: (input: CreateAlertRuleInput) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
  isLoading: boolean;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts,
  rules,
  services,
  onCreateRule,
  onDeleteRule,
  isLoading,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [ruleType, setRuleType] = useState<AlertRuleType>('p95_latency');
  const [threshold, setThreshold] = useState(300);
  const [windowMinutes, setWindowMinutes] = useState(5);
  const [severity, setSeverity] = useState<AlertSeverity>('high');
  const [cooldownMinutes, setCooldownMinutes] = useState(15);
  const [serviceId, setServiceId] = useState<string>('');

  const [alertFilter, setAlertFilter] = useState<'firing' | 'resolved' | 'all'>('firing');

  const firingAlerts = alerts.filter((a) => a.status === 'firing');
  const resolvedAlerts = alerts.filter((a) => a.status === 'resolved');
  const displayedAlerts =
    alertFilter === 'firing'
      ? firingAlerts
      : alertFilter === 'resolved'
      ? resolvedAlerts
      : alerts;

  function openDrawer() {
    setName('');
    setRuleType('p95_latency');
    setThreshold(300);
    setWindowMinutes(5);
    setSeverity('high');
    setCooldownMinutes(15);
    setServiceId('');
    setFormError(null);
    setIsDrawerOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Rule name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      await onCreateRule({
        name: name.trim(),
        ruleType,
        threshold,
        windowMinutes,
        severity,
        cooldownMinutes,
        serviceId: serviceId || null,
      });
      setIsDrawerOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create rule');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteConfirmed(id: string) {
    try {
      await onDeleteRule(id);
      setDeleteConfirmId(null);
    } catch {
      // Toast handles error feedback
    }
  }

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Alerts & Evaluation Rules</h1>
          <p className={styles.pageSubtitle}>
            Active firing alerts, historical event resolution, and threshold evaluation criteria.
          </p>
        </div>

        <button className={styles.primaryBtn} onClick={openDrawer}>
          <Plus size={16} />
          <span>Create Alert Rule</span>
        </button>
      </div>

      {/* Operational Summary Strip */}
      <div className={styles.summaryStrip}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Firing Alerts</span>
          <span className={`${styles.summaryVal} ${firingAlerts.length > 0 ? styles.summaryDown : styles.summaryUp}`}>
            {firingAlerts.length}
          </span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Resolved Events</span>
          <span className={styles.summaryVal}>{resolvedAlerts.length}</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Active Rules</span>
          <span className={styles.summaryVal}>{rules.length}</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Services in Scope</span>
          <span className={styles.summaryVal}>{services.length}</span>
        </div>
      </div>

      {/* Section 1: Alert Events Feed (Clearly Separated) */}
      <section className={styles.sectionCard} aria-label="Alert Events Feed">
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderLeft}>
            <div className={styles.titleWithIcon}>
              <BellRing
                size={18}
                className={firingAlerts.length > 0 ? styles.bellFiring : styles.bellNominal}
              />
              <h2 className={styles.sectionTitle}>Alert Telemetry Feed</h2>
            </div>
            <span className={styles.sectionSubtitle}>
              {firingAlerts.length} actively firing · {resolvedAlerts.length} resolved
            </span>
          </div>

          <div className={styles.statusTabs} role="tablist" aria-label="Filter Alerts">
            <button
              className={`${styles.tabBtn} ${alertFilter === 'firing' ? styles.tabBtnActive : ''}`}
              onClick={() => setAlertFilter('firing')}
              role="tab"
              aria-selected={alertFilter === 'firing'}
            >
              Firing ({firingAlerts.length})
            </button>
            <button
              className={`${styles.tabBtn} ${alertFilter === 'resolved' ? styles.tabBtnActive : ''}`}
              onClick={() => setAlertFilter('resolved')}
              role="tab"
              aria-selected={alertFilter === 'resolved'}
            >
              Resolved ({resolvedAlerts.length})
            </button>
            <button
              className={`${styles.tabBtn} ${alertFilter === 'all' ? styles.tabBtnActive : ''}`}
              onClick={() => setAlertFilter('all')}
              role="tab"
              aria-selected={alertFilter === 'all'}
            >
              All Events ({alerts.length})
            </button>
          </div>
        </div>

        <div className={styles.feedBody}>
          {displayedAlerts.length === 0 ? (
            <div className={styles.nominalBanner}>
              <CheckCircle2 size={22} className={styles.nominalIcon} />
              <div className={styles.nominalText}>
                <strong>
                  {alertFilter === 'firing'
                    ? 'Nominal State: Zero Alerts Firing'
                    : alertFilter === 'resolved'
                    ? 'No Resolved Alerts'
                    : 'Zero Alert Events Recorded'}
                </strong>
                <span>
                  {alertFilter === 'firing'
                    ? 'All monitored services and background probe evaluations are operating within SLA baselines.'
                    : 'Historical resolved alert records will appear here as incidents recover.'}
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.alertCardsGrid}>
              {displayedAlerts.map((alert) => {
                const isResolved = alert.status === 'resolved';
                const targetSvc = services.find((s) => s.id === alert.serviceId);

                return (
                  <article
                    key={alert.id}
                    className={`${styles.alertCard} ${
                      isResolved ? styles.alertResolved : styles.alertFiring
                    }`}
                  >
                    <div className={styles.alertCardTop}>
                      <span
                        className={`${styles.statusBadge} ${
                          isResolved ? styles.badgeResolved : styles.badgeFiring
                        }`}
                      >
                        {alert.status}
                      </span>
                      <span
                        className={`${styles.sevBadge} ${
                          alert.severity === 'critical'
                            ? styles.sevCritical
                            : alert.severity === 'high'
                            ? styles.sevHigh
                            : alert.severity === 'medium'
                            ? styles.sevMedium
                            : styles.sevLow
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </div>

                    <h3 className={styles.alertMessage}>{alert.message}</h3>

                    {targetSvc && (
                      <div className={styles.alertService}>
                        Scope: <strong className="mono">{targetSvc.name}</strong> ({targetSvc.environment})
                      </div>
                    )}

                    <div className={styles.alertTelemetryRow}>
                      <div className={styles.telemetryStat}>
                        <span>Value:</span>
                        <strong className="mono">{alert.currentValue}</strong>
                      </div>
                      <div className={styles.telemetryDivider}>/</div>
                      <div className={styles.telemetryStat}>
                        <span>Threshold:</span>
                        <strong className="mono">{alert.thresholdValue}</strong>
                      </div>
                    </div>

                    <div className={styles.alertTimestamps}>
                      <span>Triggered: {new Date(alert.triggeredAt).toLocaleTimeString()}</span>
                      {alert.resolvedAt && (
                        <span>· Resolved: {new Date(alert.resolvedAt).toLocaleTimeString()}</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Configured Alert Rules (Clearly Separated) */}
      <section className={styles.sectionCard} aria-label="Configured Alert Rules">
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderLeft}>
            <div className={styles.titleWithIcon}>
              <Sliders size={18} />
              <h2 className={styles.sectionTitle}>Evaluation Rules Configuration</h2>
            </div>
            <span className={styles.sectionSubtitle}>
              {rules.length} threshold rules actively evaluating telemetry probes
            </span>
          </div>

          <button className={styles.secondaryBtn} onClick={openDrawer}>
            <Plus size={15} />
            <span>New Rule</span>
          </button>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <colgroup>
              <col style={{ width: '22%', minWidth: '140px' }} />
              <col style={{ width: '18%', minWidth: '120px' }} />
              <col style={{ width: '15%', minWidth: '100px' }} />
              <col style={{ width: '20%', minWidth: '130px' }} />
              <col style={{ width: '10%', minWidth: '75px' }} />
              <col style={{ width: '8%', minWidth: '60px' }} />
              <col style={{ width: '7%', minWidth: '55px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className={styles.th}>Rule Identifier</th>
                <th className={styles.th}>Target Scope</th>
                <th className={styles.th}>Metric Type</th>
                <th className={styles.th}>Trigger Threshold</th>
                <th className={styles.th}>Severity</th>
                <th className={styles.th}>Cooldown</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1, 2, 3].map((n) => (
                  <tr key={n} className={styles.tr}>
                    <td className={styles.td}>
                      <div className="cp-skeleton" style={{ height: 16, width: 140 }} />
                    </td>
                    <td className={styles.td}>
                      <div className="cp-skeleton" style={{ height: 16, width: 100 }} />
                    </td>
                    <td className={styles.td}>
                      <div className="cp-skeleton" style={{ height: 16, width: 80 }} />
                    </td>
                    <td className={styles.td}>
                      <div className="cp-skeleton" style={{ height: 16, width: 90 }} />
                    </td>
                    <td className={styles.td}>
                      <div className="cp-skeleton" style={{ height: 16, width: 60 }} />
                    </td>
                    <td className={styles.td}>
                      <div className="cp-skeleton" style={{ height: 16, width: 40 }} />
                    </td>
                    <td className={styles.td} style={{ textAlign: 'right' }}>
                      <div className="cp-skeleton" style={{ height: 28, width: 28, marginLeft: 'auto' }} />
                    </td>
                  </tr>
                ))
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyTable}>
                    <div className={styles.emptyContainer}>
                      <AlertCircle size={30} style={{ color: 'var(--cp-text-muted)' }} />
                      <span className={styles.emptyTitle}>Zero Alert Rules Configured</span>
                      <span className={styles.emptySub}>
                        Create evaluation criteria to automatically trigger incidents when latency spikes or probe error rates exceed SLA limits.
                      </span>
                      <button className={styles.primaryBtn} onClick={openDrawer} style={{ marginTop: 8 }}>
                        <Plus size={15} /> Configure First Rule
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                rules.map((rule) => {
                  const targetSvc = services.find((s) => s.id === rule.serviceId);
                  return (
                    <tr key={rule.id} className={styles.tr}>
                      <td className={`${styles.td} ${styles.tdPrimary}`}>{rule.name}</td>
                      <td className={styles.td}>
                        {targetSvc ? (
                          <span className="mono" style={{ fontSize: 13, color: 'var(--cp-text-primary)' }}>
                            {targetSvc.name}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--cp-text-muted)', fontSize: 13 }}>
                            Global (All Services)
                          </span>
                        )}
                      </td>
                      <td className={`${styles.td} ${styles.tdMono}`}>{rule.ruleType}</td>
                      <td className={`${styles.td} ${styles.tdMono}`}>
                        &gt; {rule.threshold} (over {rule.windowMinutes}m window)
                      </td>
                      <td className={styles.td}>
                        <span
                          className={`${styles.sevBadge} ${
                            rule.severity === 'critical'
                              ? styles.sevCritical
                              : rule.severity === 'high'
                              ? styles.sevHigh
                              : rule.severity === 'medium'
                              ? styles.sevMedium
                              : styles.sevLow
                          }`}
                        >
                          {rule.severity}
                        </span>
                      </td>
                      <td className={`${styles.td} ${styles.tdMono}`}>{rule.cooldownMinutes}m</td>
                      <td className={styles.td} style={{ textAlign: 'right' }}>
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          onClick={() => setDeleteConfirmId(rule.id)}
                          title="Delete Alert Rule"
                          aria-label={`Delete alert rule "${rule.name}"`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Delete Rule Confirmation Modal */}
      {deleteConfirmId && (
        <div className={styles.modalOverlay} onClick={() => setDeleteConfirmId(null)} role="dialog" aria-modal="true">
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Delete Evaluation Rule</h3>
            <p className={styles.modalBody}>
              Are you sure you want to remove this alert rule? The platform will no longer monitor or evaluate telemetry for this condition.
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
                Delete Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Rule Slide-over Drawer */}
      {isDrawerOpen && (
        <div className={styles.drawerOverlay} onClick={() => setIsDrawerOpen(false)} role="dialog" aria-modal="true">
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h3 className={styles.drawerTitle}>Configure Alert Evaluation Rule</h3>
              <button
                className={styles.closeBtn}
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close drawer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.drawerForm}>
              <div className={styles.drawerBody}>
                {formError && (
                  <div className={styles.errorBanner}>{formError}</div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.label}>Rule Name *</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="e.g. High P95 Latency Trigger"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Target Service Scope</label>
                  <select
                    className={styles.select}
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                  >
                    <option value="">Global (All Services)</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.environment})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Metric Type</label>
                    <select
                      className={styles.select}
                      value={ruleType}
                      onChange={(e) => setRuleType(e.target.value as AlertRuleType)}
                    >
                      <option value="p95_latency">P95 Latency (ms)</option>
                      <option value="error_rate">Error Rate (%)</option>
                      <option value="consecutive_failures">Consecutive Failures</option>
                      <option value="service_down">Service Down</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Threshold Value *</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Severity Level</label>
                    <select
                      className={styles.select}
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Cooldown (minutes)</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={cooldownMinutes}
                      min={0}
                      onChange={(e) => setCooldownMinutes(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Evaluation Window (minutes)</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={windowMinutes}
                    min={1}
                    max={60}
                    onChange={(e) => setWindowMinutes(Number(e.target.value))}
                  />
                  <span className={styles.helperText}>
                    Duration of historical probe telemetry samples evaluated per cycle
                  </span>
                </div>
              </div>

              <div className={styles.drawerFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setIsDrawerOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Alert Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
