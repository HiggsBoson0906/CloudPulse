import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Check,
  RefreshCw,
  Info,
} from 'lucide-react';
import type { Alert, DashboardSummary, HealthCheckResult, Incident, ServiceRecord } from '../types';
import { getCheckLatency, getCheckError } from '../types';
import styles from './OverviewView.module.css';

interface OverviewViewProps {
  summary: DashboardSummary | null;
  services: ServiceRecord[];
  incidents: Incident[];
  alerts: Alert[];
  latestChecks?: Record<string, HealthCheckResult | null>;
  onAcknowledgeIncident: (id: string) => Promise<void>;
  onResolveIncident: (id: string) => Promise<void>;
  onSelectService: (serviceId: string) => void;
  isLoading: boolean;
  lastRefreshedAt?: Date | null;
  isRefreshing?: boolean;
}

interface ServiceHealthStatus {
  status: 'down' | 'degraded' | 'up' | 'paused' | 'unknown';
  label: string;
  latencyMs: number | null;
  priority: number;
}

function computeServiceHealth(
  svc: ServiceRecord,
  incidents: Incident[],
  alerts: Alert[],
  latestCheck?: HealthCheckResult | null
): ServiceHealthStatus {
  if (!svc.isEnabled) {
    return { status: 'paused', label: 'Disabled', latencyMs: null, priority: 5 };
  }

  const latencyMs = getCheckLatency(latestCheck);

  const hasIncident = incidents.some(
    (i) => i.serviceId === svc.id && (i.status === 'OPEN' || i.status === 'ACKNOWLEDGED')
  );
  if (hasIncident) {
    return {
      status: 'down',
      label: 'Incident Active',
      latencyMs,
      priority: 1,
    };
  }

  const hasFiringAlert = alerts.some((a) => a.serviceId === svc.id && a.status === 'firing');
  if (hasFiringAlert) {
    return {
      status: 'degraded',
      label: 'Alert Firing',
      latencyMs,
      priority: 2,
    };
  }

  if (latestCheck) {
    if (!latestCheck.isSuccess) {
      const errReason = getCheckError(latestCheck);
      const errLabel = latestCheck.statusCode
        ? `Probe Failing (${latestCheck.statusCode})`
        : errReason
        ? `Probe Failing (${errReason.length > 20 ? errReason.slice(0, 18) + '…' : errReason})`
        : 'Probe Failing';
      return {
        status: 'down',
        label: errLabel,
        latencyMs,
        priority: 1,
      };
    }
    return {
      status: 'up',
      label: 'Operational',
      latencyMs,
      priority: 4,
    };
  }

  return { status: 'unknown', label: 'Pending Check', latencyMs: null, priority: 3 };
}

function formatLastChecked(date: Date | null | undefined): string {
  if (!date || isNaN(date.getTime())) return 'Awaiting initial check';
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const mins = String(date.getUTCMinutes()).padStart(2, '0');
  const secs = String(date.getUTCSeconds()).padStart(2, '0');
  return `${hours}:${mins}:${secs} UTC`;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  summary,
  services,
  incidents,
  alerts,
  latestChecks = {},
  onAcknowledgeIncident,
  onResolveIncident,
  onSelectService,
  isLoading,
  lastRefreshedAt,
  isRefreshing = false,
}) => {
  const activeIncidents = incidents.filter(
    (inc) => inc.status === 'OPEN' || inc.status === 'ACKNOWLEDGED'
  );
  const firingAlerts = alerts.filter((alt) => alt.status === 'firing');
  const enabledServices = services.filter((s) => s.isEnabled);

  const effectiveTimestamp =
    lastRefreshedAt ?? (summary?.timestamp ? new Date(summary.timestamp) : null);

  // Compute failing and degraded services by checking both backend summary counts AND real-time probe evaluation
  const computedDownCount = enabledServices.filter(
    (s) => computeServiceHealth(s, incidents, alerts, latestChecks[s.id]).status === 'down'
  ).length;
  const computedDegradedCount = enabledServices.filter(
    (s) => computeServiceHealth(s, incidents, alerts, latestChecks[s.id]).status === 'degraded'
  ).length;

  const failingServicesCount = Math.max(summary?.failingServices ?? 0, computedDownCount);
  const degradedServicesCount = Math.max(summary?.degradedServices ?? 0, computedDegradedCount);
  const availability = summary?.overallAvailabilityPercent;
  const isAvailabilityDegraded =
    availability !== null && availability !== undefined && availability < 99.0 && enabledServices.length > 0;

  const hasServiceDegradation =
    failingServicesCount > 0 || degradedServicesCount > 0 || isAvailabilityDegraded;

  // Prioritize unhealthy services first (priority 1 = Down/Incident, 2 = Degraded, 3 = Unknown, 4 = Operational, 5 = Disabled)
  const prioritizedServices = [...services].sort((a, b) => {
    const healthA = computeServiceHealth(a, incidents, alerts, latestChecks[a.id]);
    const healthB = computeServiceHealth(b, incidents, alerts, latestChecks[b.id]);
    if (healthA.priority !== healthB.priority) {
      return healthA.priority - healthB.priority;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={styles.overviewContainer}>
      {/* TIER 1: OPERATIONAL BANNER WITH ACCURATE MULTI-TIER STATUS */}
      {isLoading && !summary && services.length === 0 ? (
        <section className={styles.connectingBanner} aria-label="Telemetry Connecting">
          <div className={styles.connectingLeft}>
            <RefreshCw className={styles.spinning} size={18} />
            <div>
              <div className={styles.warningTitle}>Evaluating Fleet Telemetry...</div>
              <div className={styles.warningSubtitle}>
                Connecting to telemetry plane and polling initial health probes
              </div>
            </div>
          </div>
        </section>
      ) : activeIncidents.length > 0 ? (
        <section className={styles.incidentBanner} aria-label="Active Incidents">
          <div className={styles.bannerHeader}>
            <div className={styles.bannerTitleGroup}>
              <AlertTriangle className={styles.bannerIcon} size={18} />
              <h2 className={styles.bannerTitle}>
                Operational Triage: {activeIncidents.length} Active Incident
                {activeIncidents.length > 1 ? 's' : ''}
              </h2>
            </div>
            {firingAlerts.length > 0 && (
              <span className={styles.incidentMeta}>
                {firingAlerts.length} Firing Alert{firingAlerts.length > 1 ? 's' : ''} Triggered
              </span>
            )}
          </div>

          <div className={styles.incidentList}>
            {activeIncidents.map((incident) => (
              <div key={incident.id} className={styles.incidentRow}>
                <div className={styles.incidentInfo}>
                  <div className={styles.incidentRowTitle}>{incident.title}</div>
                  <div className={styles.incidentMeta}>
                    <span className="mono">ID: {incident.id.slice(0, 8)}</span>
                    <span>•</span>
                    <span style={{ textTransform: 'capitalize' }}>
                      Severity: <strong>{incident.severity}</strong>
                    </span>
                    <span>•</span>
                    <span>Status: {incident.status}</span>
                    <span>•</span>
                    <span className="mono">
                      Opened: {new Date(incident.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' })} UTC
                    </span>
                  </div>
                </div>

                <div className={styles.incidentActions}>
                  {incident.status === 'OPEN' && (
                    <button
                      className={`${styles.actionBtn} ${styles.ackBtn}`}
                      onClick={() => onAcknowledgeIncident(incident.id)}
                      title="Acknowledge incident"
                      aria-label={`Acknowledge incident "${incident.title}"`}
                    >
                      <Check size={14} />
                      Acknowledge
                    </button>
                  )}
                  <button
                    className={`${styles.actionBtn} ${styles.resolveBtn}`}
                    onClick={() => onResolveIncident(incident.id)}
                    title="Mark incident as resolved"
                    aria-label={`Resolve incident "${incident.title}"`}
                  >
                    <CheckCircle2 size={14} />
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : hasServiceDegradation ? (
        <section className={styles.warningBanner} aria-label="Service Degradation Warning">
          <div className={styles.warningLeft}>
            <AlertTriangle className={styles.warningIcon} size={20} />
            <div>
              <div className={styles.warningTitle}>
                Service Degradation Detected — No Active Incidents
              </div>
              <div className={styles.warningSubtitle}>
                {failingServicesCount > 0 && `${failingServicesCount} service${failingServicesCount > 1 ? 's' : ''} failing probes`}
                {failingServicesCount > 0 && degradedServicesCount > 0 && ' • '}
                {degradedServicesCount > 0 && `${degradedServicesCount} service${degradedServicesCount > 1 ? 's' : ''} degraded`}
                {availability !== null && availability !== undefined && ` • Platform Availability: ${availability.toFixed(2)}%`}
                {' — investigate probe diagnostics below or configure automated alert rules.'}
              </div>
            </div>
          </div>
          <div className={styles.incidentMeta}>
            {isRefreshing ? (
              <>
                <RefreshCw size={13} className={styles.spinning} />
                <span>Refreshing telemetry...</span>
              </>
            ) : (
              <>
                <Clock size={13} />
                <span>Last checked: {formatLastChecked(effectiveTimestamp)}</span>
              </>
            )}
          </div>
        </section>
      ) : firingAlerts.length > 0 ? (
        <section className={styles.warningBanner} aria-label="Threshold Violations Warning">
          <div className={styles.warningLeft}>
            <AlertTriangle className={styles.warningIcon} size={20} />
            <div>
              <div className={styles.warningTitle}>
                Threshold Violations: {firingAlerts.length} Firing Alert{firingAlerts.length > 1 ? 's' : ''} — No Active Incidents
              </div>
              <div className={styles.warningSubtitle}>
                Telemetry thresholds breached. Check the Alerts view to triage firing rules.
              </div>
            </div>
          </div>
          <div className={styles.incidentMeta}>
            {isRefreshing ? (
              <>
                <RefreshCw size={13} className={styles.spinning} />
                <span>Refreshing telemetry...</span>
              </>
            ) : (
              <>
                <Clock size={13} />
                <span>Last checked: {formatLastChecked(effectiveTimestamp)}</span>
              </>
            )}
          </div>
        </section>
      ) : services.length === 0 ? (
        <section className={styles.idleBanner} aria-label="Monitoring Plane Idle">
          <div className={styles.warningLeft}>
            <Info size={18} style={{ color: 'var(--cp-text-muted)' }} />
            <div>
              <div className={styles.warningTitle} style={{ color: 'var(--cp-text-secondary)' }}>
                Monitoring Plane Idle — No Services Registered
              </div>
              <div className={styles.warningSubtitle}>
                Register services to begin automated health probes and incident detection.
              </div>
            </div>
          </div>
          <div className={styles.incidentMeta}>
            {isRefreshing ? (
              <>
                <RefreshCw size={13} className={styles.spinning} />
                <span>Refreshing telemetry...</span>
              </>
            ) : (
              <>
                <Clock size={13} />
                <span>Last checked: {formatLastChecked(effectiveTimestamp)}</span>
              </>
            )}
          </div>
        </section>
      ) : (
        <section className={styles.nominalBanner} aria-label="System Health">
          <div className={styles.nominalLeft}>
            <ShieldCheck size={20} />
            <span>All Systems Nominal — Zero Active Incidents</span>
          </div>
          <div className={styles.incidentMeta}>
            {isRefreshing ? (
              <>
                <RefreshCw size={13} className={styles.spinning} />
                <span>Refreshing telemetry...</span>
              </>
            ) : (
              <>
                <Clock size={13} />
                <span>Last checked: {formatLastChecked(effectiveTimestamp)}</span>
              </>
            )}
          </div>
        </section>
      )}

      {/* TIER 2: PLATFORM VITALS STRIP */}
      <section className={styles.vitalsRibbon} aria-label="Platform Vitals">
        <div className={styles.vitalItem}>
          <span className={styles.vitalLabel}>Platform Availability</span>
          <div className={styles.vitalValue}>
            {summary?.overallAvailabilityPercent !== null && summary?.overallAvailabilityPercent !== undefined ? (
              <span>{summary.overallAvailabilityPercent.toFixed(2)}%</span>
            ) : (
              <span style={{ color: 'var(--cp-text-muted)' }}>N/A</span>
            )}
          </div>
          <span className={styles.vitalUnit}>Trailing 15-minute global window</span>
        </div>

        <div className={styles.vitalItem}>
          <span className={styles.vitalLabel}>Monitored Services</span>
          <div className={styles.vitalValue}>
            <span>{summary?.enabledServices ?? services.filter((s) => s.isEnabled).length}</span>
            <span className={styles.vitalUnit}>
              / {summary?.totalServices ?? services.length} configured
            </span>
          </div>
          <div className={styles.statusRatios}>
            <span className={styles.ratioUp}>● {summary?.healthyServices ?? 0} Up</span>
            <span className={styles.ratioDegraded}>● {summary?.degradedServices ?? 0} Degraded</span>
            <span className={styles.ratioDown}>● {summary?.failingServices ?? 0} Failing</span>
          </div>
        </div>

        <div className={styles.vitalItem}>
          <span className={styles.vitalLabel}>Active Incidents & Alerts</span>
          <div className={styles.vitalValue}>
            <span style={{ color: activeIncidents.length > 0 ? 'var(--cp-status-down)' : 'inherit' }}>
              {summary?.activeIncidentsCount ?? activeIncidents.length}
            </span>
            <span className={styles.vitalUnit}>
              incidents ({summary?.activeAlertsCount ?? firingAlerts.length} alerts)
            </span>
          </div>
          <span className={styles.vitalUnit}>Active operational issues</span>
        </div>
      </section>

      {/* TIER 3: SERVICE HEALTH DIRECTORY (PRIORITIZED BY HEALTH) */}
      <section className={styles.directorySection} aria-label="Monitored Services Directory">
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Service Operational Directory</h2>
            <span style={{ fontSize: '11px', color: 'var(--cp-text-muted)' }}>
              Prioritized by health status: degraded and failing services listed first
            </span>
          </div>
          <span className={styles.vitalUnit}>{services.length} services registered</span>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Service Name</th>
                <th className={styles.th}>Environment</th>
                <th className={styles.th}>Target URL</th>
                <th className={styles.th}>Latest Latency</th>
                <th className={styles.th}>Operational Status</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  {[1, 2, 3].map((n) => (
                    <tr key={n} className={styles.tr}>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: '16px', width: '160px' }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: '16px', width: '80px' }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: '16px', width: '220px' }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: '16px', width: '60px' }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: '16px', width: '90px' }} />
                      </td>
                      <td className={styles.td} style={{ textAlign: 'right' }}>
                        <div className="cp-skeleton" style={{ height: '24px', width: '110px', marginLeft: 'auto' }} />
                      </td>
                    </tr>
                  ))}
                </>
              ) : prioritizedServices.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyState}>
                    No services registered yet. Navigate to Services to register your first endpoint.
                  </td>
                </tr>
              ) : (
                prioritizedServices.map((svc) => {
                  const health = computeServiceHealth(svc, incidents, alerts, latestChecks[svc.id]);
                  return (
                    <tr key={svc.id} className={styles.tr}>
                      <td className={`${styles.td} ${styles.tdPrimary}`}>
                        <button
                          onClick={() => onSelectService(svc.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                            padding: 0,
                          }}
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
                      <td className={`${styles.td} mono`}>
                        {svc.baseUrl}{svc.healthCheckPath}
                      </td>
                      <td className={`${styles.td} mono`}>
                        {typeof health.latencyMs === 'number' && !isNaN(health.latencyMs) && health.latencyMs >= 0 ? (
                          `${health.latencyMs}ms`
                        ) : (
                          <span title="No recent check" style={{ color: 'var(--cp-text-muted)' }}>
                            —
                          </span>
                        )}
                      </td>
                      <td className={styles.td}>
                        <span
                          title={
                            latestChecks[svc.id]
                              ? getCheckError(latestChecks[svc.id]) ?? (latestChecks[svc.id]?.isSuccess ? 'Health probe passing' : 'Probe failed')
                              : 'No probe executed yet'
                          }
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            fontFamily: 'var(--cp-font-mono)',
                            textTransform: 'uppercase',
                            backgroundColor:
                              health.status === 'down'
                                ? 'var(--cp-status-down-bg)'
                                : health.status === 'degraded'
                                ? 'var(--cp-status-degraded-bg)'
                                : health.status === 'up'
                                ? 'var(--cp-status-up-bg)'
                                : 'rgba(255,255,255,0.05)',
                            color:
                              health.status === 'down'
                                ? 'var(--cp-status-down)'
                                : health.status === 'degraded'
                                ? 'var(--cp-status-degraded)'
                                : health.status === 'up'
                                ? 'var(--cp-status-up)'
                                : 'var(--cp-text-muted)',
                            border: `1px solid ${
                              health.status === 'down'
                                ? 'var(--cp-status-down-border)'
                                : health.status === 'degraded'
                                ? 'var(--cp-status-degraded-border)'
                                : health.status === 'up'
                                ? 'var(--cp-status-up-border)'
                                : 'var(--cp-border-subtle)'
                            }`,
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: 'currentColor',
                            }}
                          />
                          {health.label}
                        </span>
                      </td>
                      <td className={styles.td} style={{ textAlign: 'right' }}>
                        <button
                          className={styles.viewDetailBtn}
                          onClick={() => onSelectService(svc.id)}
                          title="View telemetry and metrics"
                        >
                          Inspect Telemetry <ArrowRight size={12} style={{ verticalAlign: 'middle' }} />
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
    </div>
  );
};
