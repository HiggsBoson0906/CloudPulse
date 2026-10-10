import React, { useState } from 'react';
import { AlertCircle, Plus, Trash2, X } from 'lucide-react';
import type { Alert, AlertRule, AlertRuleType, AlertSeverity, CreateAlertRuleInput, ServiceRecord } from '../types';
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

  return (
    <div className={styles.container}>
      {/* Alert Feed Section with Status Filter Tabs */}
      <section className={styles.firingSection} aria-label="Platform Alerts">
        <div className={styles.firingHeader}>
          <div>
            <h2 className={styles.firingTitle}>
              <AlertCircle
                size={18}
                style={{
                  color: firingAlerts.length > 0 ? 'var(--cp-status-down)' : 'var(--cp-status-up)',
                }}
              />
              Platform Alert Telemetry
            </h2>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--cp-text-muted)' }}>
              Real-time rule evaluations & resolution history
            </span>
          </div>

          <div className={styles.statusTabs}>
            <button
              className={`${styles.tabBtn} ${alertFilter === 'firing' ? styles.tabBtnActive : ''}`}
              onClick={() => setAlertFilter('firing')}
            >
              Firing ({firingAlerts.length})
            </button>
            <button
              className={`${styles.tabBtn} ${alertFilter === 'resolved' ? styles.tabBtnActive : ''}`}
              onClick={() => setAlertFilter('resolved')}
            >
              Resolved ({resolvedAlerts.length})
            </button>
            <button
              className={`${styles.tabBtn} ${alertFilter === 'all' ? styles.tabBtnActive : ''}`}
              onClick={() => setAlertFilter('all')}
            >
              All ({alerts.length})
            </button>
          </div>
        </div>

        {displayedAlerts.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'var(--cp-bg-well)',
              border: '1px solid var(--cp-status-up-border)',
              borderLeft: '3px solid var(--cp-status-up)',
              borderRadius: 'var(--cp-radius-sm)',
              padding: '12px 16px',
              fontSize: '13px',
              color: 'var(--cp-status-up)',
            }}
          >
            <span style={{ fontWeight: 600 }}>Nominal State:</span>
            <span style={{ color: 'var(--cp-text-secondary)' }}>
              {alertFilter === 'firing'
                ? 'Zero alerts currently firing. All monitored services operating within SLA thresholds.'
                : alertFilter === 'resolved'
                ? 'No resolved alert records found.'
                : 'Zero alert events recorded in platform history.'}
            </span>
          </div>
        ) : (
          <div className={styles.firingGrid}>
            {displayedAlerts.map((alert) => {
              const isResolved = alert.status === 'resolved';
              return (
                <div
                  key={alert.id}
                  className={isResolved ? styles.resolvedCard : styles.firingCard}
                >
                  <div className={styles.firingCardTop}>
                    <span className={styles.firingCardTitle}>{alert.message}</span>
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

                  <div className={styles.firingMeta}>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        backgroundColor: isResolved
                          ? 'var(--cp-status-up-bg)'
                          : 'var(--cp-status-down-bg)',
                        color: isResolved ? 'var(--cp-status-up)' : 'var(--cp-status-down)',
                      }}
                    >
                      {alert.status}
                    </span>
                    <span>•</span>
                    <span className="mono">Value: {alert.currentValue}</span>
                    <span>/</span>
                    <span className="mono">Threshold: {alert.thresholdValue}</span>
                    <span>•</span>
                    <span>Triggered: {new Date(alert.triggeredAt).toLocaleTimeString()}</span>
                    {alert.resolvedAt && (
                      <>
                        <span>•</span>
                        <span>Resolved: {new Date(alert.resolvedAt).toLocaleTimeString()}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Alert Rules Manager */}
      <section className={styles.rulesSection} aria-label="Configured Alert Rules">
        <div className={styles.sectionHeader}>
          <h2 className={styles.firingTitle}>Configured Alert Evaluation Rules</h2>
          <button className={styles.primaryBtn} onClick={openDrawer}>
            <Plus size={16} /> Create Alert Rule
          </button>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Rule Name</th>
                <th className={styles.th}>Scope</th>
                <th className={styles.th}>Rule Type</th>
                <th className={styles.th}>Threshold</th>
                <th className={styles.th}>Severity</th>
                <th className={styles.th}>Cooldown</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  {[1, 2, 3].map((n) => (
                    <tr key={n} className={styles.tr}>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: '16px', width: '130px' }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: '16px', width: '100px' }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: '16px', width: '80px' }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: '16px', width: '90px' }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: '16px', width: '60px' }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: '16px', width: '40px' }} />
                      </td>
                      <td className={styles.td} style={{ textAlign: 'right' }}>
                        <div className="cp-skeleton" style={{ height: '24px', width: '24px', marginLeft: 'auto' }} />
                      </td>
                    </tr>
                  ))}
                </>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--cp-text-muted)' }}>
                    No alert rules created yet. Click &quot;Create Alert Rule&quot; to configure a latency or failure threshold.
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
                          <span style={{ color: 'var(--cp-text-primary)' }}>{targetSvc.name}</span>
                        ) : (
                          <span style={{ color: 'var(--cp-text-muted)' }}>Global (All services)</span>
                        )}
                      </td>
                      <td className={`${styles.td} mono`}>{rule.ruleType}</td>
                      <td className={`${styles.td} mono`}>
                        &gt; {rule.threshold} (over {rule.windowMinutes}m)
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
                      <td className={`${styles.td} mono`}>{rule.cooldownMinutes}m</td>
                      <td className={styles.td} style={{ textAlign: 'right' }}>
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          onClick={() => {
                            if (window.confirm(`Delete rule "${rule.name}"?`)) {
                              onDeleteRule(rule.id);
                            }
                          }}
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

      {/* Create Rule Drawer */}
      {isDrawerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            zIndex: 100,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            style={{
              width: '460px',
              backgroundColor: 'var(--cp-bg-surface)',
              borderLeft: '1px solid var(--cp-border-strong)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 24px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--cp-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Create New Alert Rule</h3>
              <button
                className={styles.iconBtn}
                onClick={() => setIsDrawerOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {formError && (
                  <div
                    style={{
                      backgroundColor: 'var(--cp-status-down-bg)',
                      border: '1px solid var(--cp-status-down-border)',
                      color: 'var(--cp-status-down)',
                      padding: '10px 14px',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                  >
                    {formError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cp-text-secondary)' }}>Rule Name *</label>
                  <input
                    type="text"
                    style={{
                      backgroundColor: 'var(--cp-bg-well)',
                      color: 'var(--cp-text-primary)',
                      border: '1px solid var(--cp-border-subtle)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                    placeholder="e.g. High P95 Latency Trigger"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cp-text-secondary)' }}>Target Scope</label>
                  <select
                    style={{
                      backgroundColor: 'var(--cp-bg-well)',
                      color: 'var(--cp-text-primary)',
                      border: '1px solid var(--cp-border-subtle)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '13px',
                      outline: 'none',
                    }}
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cp-text-secondary)' }}>Rule Metric Type</label>
                    <select
                      style={{
                        backgroundColor: 'var(--cp-bg-well)',
                        color: 'var(--cp-text-primary)',
                        border: '1px solid var(--cp-border-subtle)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                      value={ruleType}
                      onChange={(e) => setRuleType(e.target.value as AlertRuleType)}
                    >
                      <option value="p95_latency">P95 Latency (ms)</option>
                      <option value="error_rate">Error Rate (%)</option>
                      <option value="consecutive_failures">Consecutive Failures</option>
                      <option value="service_down">Service Down</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cp-text-secondary)' }}>Threshold Value *</label>
                    <input
                      type="number"
                      style={{
                        backgroundColor: 'var(--cp-bg-well)',
                        color: 'var(--cp-text-primary)',
                        border: '1px solid var(--cp-border-subtle)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cp-text-secondary)' }}>Severity</label>
                    <select
                      style={{
                        backgroundColor: 'var(--cp-bg-well)',
                        color: 'var(--cp-text-primary)',
                        border: '1px solid var(--cp-border-subtle)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cp-text-secondary)' }}>Cooldown (minutes)</label>
                    <input
                      type="number"
                      style={{
                        backgroundColor: 'var(--cp-bg-well)',
                        color: 'var(--cp-text-primary)',
                        border: '1px solid var(--cp-border-subtle)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                      value={cooldownMinutes}
                      min={0}
                      onChange={(e) => setCooldownMinutes(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid var(--cp-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '12px',
                }}
              >
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    color: 'var(--cp-text-secondary)',
                    border: '1px solid var(--cp-border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setIsDrawerOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
