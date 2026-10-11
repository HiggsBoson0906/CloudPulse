import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Check,
  Copy,
  RefreshCw,
  ArrowUpDown,
  Search,
  Activity,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import type { Alert, DashboardSummary, HealthCheckResult, Incident, ServiceRecord } from '../types';
import { getCheckLatency, getCheckError } from '../types';
import { api } from '../api/client';
import { LatencyChart } from '../components/telemetry/LatencyChart';
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
    return { status: 'down', label: 'Incident Active', latencyMs, priority: 1 };
  }

  const hasFiringAlert = alerts.some((a) => a.serviceId === svc.id && a.status === 'firing');
  if (hasFiringAlert) {
    return { status: 'degraded', label: 'Alert Firing', latencyMs, priority: 2 };
  }

  if (latestCheck) {
    if (!latestCheck.isSuccess) {
      const errReason = getCheckError(latestCheck);
      const errLabel = latestCheck.statusCode
        ? `Failing (${latestCheck.statusCode})`
        : errReason
        ? `Failing (${errReason.length > 18 ? errReason.slice(0, 16) + '…' : errReason})`
        : 'Probe Failing';
      return { status: 'down', label: errLabel, latencyMs, priority: 1 };
    }
    return { status: 'up', label: 'Operational', latencyMs, priority: 4 };
  }

  return { status: 'unknown', label: 'Pending Check', latencyMs: null, priority: 3 };
}

type SortKey = 'name' | 'env' | 'latency' | 'status';

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
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortAsc, setSortAsc] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [copiedEndpointId, setCopiedEndpointId] = useState<string | null>(null);

  const activeIncidents = useMemo(
    () => incidents.filter((inc) => inc.status === 'OPEN' || inc.status === 'ACKNOWLEDGED'),
    [incidents]
  );
  const firingAlerts = useMemo(() => alerts.filter((alt) => alt.status === 'firing'), [alerts]);
  const enabledServices = useMemo(() => services.filter((s) => s.isEnabled), [services]);

  const healthyCount = summary?.healthyServices ?? 0;
  const failingCount = Math.max(
    summary?.failingServices ?? 0,
    enabledServices.filter(
      (s) => computeServiceHealth(s, incidents, alerts, latestChecks[s.id]).status === 'down'
    ).length
  );
  const availability = summary?.overallAvailabilityPercent;

  // Service selector state for historical probe graph
  const [selectedGraphServiceId, setSelectedGraphServiceId] = useState<string | null>(null);
  const [graphChecks, setGraphChecks] = useState<HealthCheckResult[]>([]);
  const [isGraphLoading, setIsGraphLoading] = useState<boolean>(false);

  // Fallback gracefully if selected service is deleted or unset
  const activeService = useMemo(() => {
    if (services.length === 0) return null;
    const match = services.find((s) => s.id === selectedGraphServiceId);
    return match ?? services[0];
  }, [services, selectedGraphServiceId]);

  // Fetch real persisted checks from backend
  useEffect(() => {
    let ignore = false;
    const targetId = activeService?.id;
    if (!targetId) return;

    queueMicrotask(() => {
      if (!ignore) setIsGraphLoading(true);
    });

    api.getServiceChecks(targetId, 50)
      .then((data) => {
        if (!ignore) {
          setGraphChecks(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        console.warn(`Failed to fetch probe history for service ${targetId}:`, err);
        if (!ignore) {
          setGraphChecks([]);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsGraphLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [activeService?.id, lastRefreshedAt]);

  const displayedChecks = useMemo(() => (activeService ? graphChecks : []), [activeService, graphChecks]);

  const activeServiceLatency = useMemo(() => {
    if (!activeService) return null;
    const latest = latestChecks[activeService.id] ?? displayedChecks[0] ?? null;
    return getCheckLatency(latest);
  }, [activeService, latestChecks, displayedChecks]);

  const timeRangeLabel = useMemo(() => {
    if (displayedChecks.length < 2) return null;
    const newestTime = new Date(displayedChecks[0].checkTimestamp).getTime();
    const oldestTime = new Date(displayedChecks[displayedChecks.length - 1].checkTimestamp).getTime();
    const diffMs = Math.max(0, newestTime - oldestTime);
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin >= 60) {
      const diffHours = (diffMin / 60).toFixed(1);
      return `Trailing ${displayedChecks.length} checks (~${diffHours}h range)`;
    }
    if (diffMin >= 1) {
      return `Trailing ${displayedChecks.length} checks (~${diffMin}m range)`;
    }
    return `Trailing ${displayedChecks.length} checks (<1m range)`;
  }, [displayedChecks]);

  // Filter and sort services
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.baseUrl.toLowerCase().includes(q) ||
        s.environment.toLowerCase().includes(q)
      );
    });
  }, [services, searchFilter]);

  const sortedServices = useMemo(() => {
    return [...filteredServices].sort((a, b) => {
      const hA = computeServiceHealth(a, incidents, alerts, latestChecks[a.id]);
      const hB = computeServiceHealth(b, incidents, alerts, latestChecks[b.id]);
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'env') cmp = (a.environment ?? '').localeCompare(b.environment ?? '');
      else if (sortKey === 'latency') cmp = (hA.latencyMs ?? 999999) - (hB.latencyMs ?? 999999);
      else cmp = hA.priority - hB.priority;
      return sortAsc ? cmp : -cmp;
    });
  }, [filteredServices, incidents, alerts, latestChecks, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  async function handleAck(id: string) {
    try {
      setActionInProgress(id);
      await onAcknowledgeIncident(id);
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleResolve(id: string) {
    try {
      setActionInProgress(id);
      await onResolveIncident(id);
    } finally {
      setActionInProgress(null);
    }
  }

  // Stat cards definition with high visual hierarchy
  const statCards = [
    {
      label: 'Total Monitored',
      value: summary?.totalServices ?? services.length,
      sublabel: `${enabledServices.length} active / ${services.length - enabledServices.length} paused`,
      statusClass: '',
    },
    {
      label: 'Platform Availability',
      value: availability !== null && availability !== undefined ? `${availability.toFixed(2)}%` : 'N/A',
      sublabel: 'Aggregated SLA window',
      statusClass: typeof availability === 'number' && availability < 99 ? styles.cardWarning : '',
    },
    {
      label: 'Healthy Services',
      value: healthyCount,
      sublabel: 'Probes returning HTTP 2xx',
      statusClass: styles.cardUp,
    },
    {
      label: 'Failing Probes',
      value: failingCount,
      sublabel: failingCount > 0 ? 'Requires immediate triage' : 'Zero probe failures',
      statusClass: failingCount > 0 ? styles.cardDown : '',
    },
    {
      label: 'Active Incidents',
      value: summary?.activeIncidentsCount ?? activeIncidents.length,
      sublabel: activeIncidents.length > 0 ? 'Triggered operational events' : 'Nominal state',
      statusClass: activeIncidents.length > 0 ? styles.cardIncident : '',
    },
    {
      label: 'Firing Alerts',
      value: summary?.activeAlertsCount ?? firingAlerts.length,
      sublabel: firingAlerts.length > 0 ? 'Threshold evaluations tripped' : 'Within baseline limits',
      statusClass: firingAlerts.length > 0 ? styles.cardDegraded : '',
    },
  ];

  return (
    <div className={styles.overviewContainer}>
      {/* KPI STAT CARDS (Fluid 6-card grid) */}
      <section className={styles.statsGrid} aria-label="Platform Telemetry Metrics">
        {statCards.map((card) => (
          <div key={card.label} className={`${styles.statCard} ${card.statusClass}`}>
            <span className={styles.statLabel}>{card.label}</span>
            <div className={styles.statValueRow}>
              <span className={styles.statValue}>
                {isLoading ? (
                  <span className="cp-skeleton" style={{ display: 'inline-block', width: 64, height: 38, borderRadius: 6 }} />
                ) : (
                  card.value
                )}
              </span>
            </div>
            <span className={styles.statSublabel}>{card.sublabel}</span>
          </div>
        ))}
      </section>

      {/* OPERATIONAL WORKSPACE: SERVICE MATRIX + REAL TELEMETRY & INCIDENT PANELS */}
      <div className={styles.mainGrid}>
        {/* Service Health Matrix (High-Density Operational Table) */}
        <section className={styles.matrixSection} aria-label="Service Health Matrix">
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderLeft}>
              <h2 className={styles.panelTitle}>Service Health Matrix</h2>
              <span className={styles.panelSubtitle}>
                {filteredServices.length} of {services.length} services
                {lastRefreshedAt && ` · Synced ${lastRefreshedAt.toLocaleTimeString()}`}
              </span>
            </div>

            <div className={styles.searchWrapper}>
              <Search size={14} className={styles.searchIcon} />
              <input
                type="search"
                className={styles.matrixSearch}
                placeholder="Filter services or endpoints..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                aria-label="Filter service health matrix"
              />
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <colgroup>
                <col style={{ width: '25%', minWidth: '130px' }} />
                <col style={{ width: '15%', minWidth: '85px' }} />
                <col style={{ width: '33%', minWidth: '150px' }} />
                <col style={{ width: '13%', minWidth: '75px' }} />
                <col style={{ width: '14%', minWidth: '105px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={styles.th}>
                    <button className={styles.sortBtn} onClick={() => toggleSort('name')}>
                      Service Name
                      <ArrowUpDown size={12} />
                      {sortKey === 'name' && <span>{sortAsc ? '↑' : '↓'}</span>}
                    </button>
                  </th>
                  <th className={styles.th}>
                    <button className={styles.sortBtn} onClick={() => toggleSort('env')}>
                      Environment
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className={styles.th}>Target Probe Endpoint</th>
                  <th className={styles.th}>
                    <button className={styles.sortBtn} onClick={() => toggleSort('latency')}>
                      Latest Latency
                      <ArrowUpDown size={12} />
                      {sortKey === 'latency' && <span>{sortAsc ? '↑' : '↓'}</span>}
                    </button>
                  </th>
                  <th className={styles.th}>
                    <button className={styles.sortBtn} onClick={() => toggleSort('status')}>
                      Health Status
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [1, 2, 3, 4, 5].map((n) => (
                    <tr key={n} className={styles.tr}>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: 16, width: 140 }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: 16, width: 70 }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: 16, width: 220 }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: 16, width: 60 }} />
                      </td>
                      <td className={styles.td}>
                        <div className="cp-skeleton" style={{ height: 20, width: 80 }} />
                      </td>
                    </tr>
                  ))
                ) : sortedServices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyState}>
                      <div className={styles.emptyContent}>
                        <Activity size={24} style={{ color: 'var(--cp-text-muted)' }} />
                        <span>
                          {searchFilter ? 'No services match the active filter.' : 'No monitored services registered yet.'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedServices.map((svc) => {
                    const health = computeServiceHealth(svc, incidents, alerts, latestChecks[svc.id]);
                    const fullEndpoint = `${svc.baseUrl}${svc.healthCheckPath}`;
                    const isCopied = copiedEndpointId === svc.id;

                    return (
                      <tr key={svc.id} className={styles.tr}>
                        <td className={`${styles.td} ${styles.tdPrimary}`}>
                          <button
                            className={styles.svcNameBtn}
                            onClick={() => onSelectService(svc.id)}
                            title={`Inspect detailed telemetry for ${svc.name}`}
                          >
                            <span>{svc.name}</span>
                            <ExternalLink size={12} className={styles.externalIcon} />
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
                              title={`${fullEndpoint} (Click copy icon to copy)`}
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
                              title={isCopied ? 'Copied to clipboard!' : 'Copy target endpoint'}
                              aria-label="Copy target endpoint"
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
                          {typeof health.latencyMs === 'number' && !isNaN(health.latencyMs) && health.latencyMs >= 0 ? (
                            <span
                              className={
                                health.latencyMs > 300
                                  ? styles.latencyHigh
                                  : health.latencyMs > 100
                                  ? styles.latencyMed
                                  : styles.latencyNormal
                              }
                            >
                              {health.latencyMs}ms
                            </span>
                          ) : (
                            <span className={styles.dash}>—</span>
                          )}
                        </td>
                        <td className={styles.td}>
                          <span className={`${styles.statusBadge} ${styles[`status_${health.status}`]}`}>
                            <span className={styles.statusDotSmall} />
                            {health.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* RIGHT DIAGNOSTIC PANEL: INCIDENT FEED & TRUTHFUL PROBE LATENCY */}
        <aside className={styles.rightPanel}>
          {/* Active Incident Workspace */}
          <section className={styles.panelCard} aria-label="Incident Management Workspace">
            <div className={styles.panelHeader}>
              <div className={styles.panelHeaderLeft}>
                <h3 className={styles.panelTitle}>Active Incidents</h3>
                <span className={styles.panelSubtitle}>
                  {activeIncidents.length === 0 ? 'Nominal' : `${activeIncidents.length} requiring attention`}
                </span>
              </div>
            </div>

            {activeIncidents.length === 0 ? (
              <div className={styles.emptyIncident}>
                <ShieldCheck size={32} className={styles.nominalIcon} />
                <span className={styles.emptyTitle}>Zero Active Incidents</span>
                <span className={styles.emptySub}>
                  Monitored endpoints and services are operating within approved SLAs.
                </span>
              </div>
            ) : (
              <div className={styles.incidentList}>
                {activeIncidents.slice(0, 3).map((inc) => {
                  const targetSvc = services.find((s) => s.id === inc.serviceId);
                  const isAcking = actionInProgress === inc.id;

                  return (
                    <article key={inc.id} className={styles.incidentItem}>
                      <div className={styles.incidentItemHeader}>
                        <span
                          className={`${styles.incidentPill} ${
                            inc.status === 'OPEN' ? styles.pillOpen : styles.pillAck
                          }`}
                        >
                          {inc.status}
                        </span>
                        <span className={styles.incidentTime}>
                          {new Date(inc.openedAt).toLocaleTimeString()}
                        </span>
                      </div>

                      <h4 className={styles.incidentItemTitle}>{inc.title}</h4>

                      {targetSvc && (
                        <div className={styles.incidentTarget}>
                          Target: <strong className="mono">{targetSvc.name}</strong>
                        </div>
                      )}

                      {inc.summary && (
                        <p className={styles.incidentSummary}>{inc.summary}</p>
                      )}

                      {/* Truthful Milestones */}
                      <div className={styles.milestoneTimeline}>
                        <div className={styles.milestonePoint}>
                          <span className={styles.milestoneDotOpen} />
                          <span>Triggered: {new Date(inc.openedAt).toLocaleString()}</span>
                        </div>
                        {inc.acknowledgedAt && (
                          <div className={styles.milestonePoint}>
                            <span className={styles.milestoneDotAck} />
                            <span>Acknowledged: {new Date(inc.acknowledgedAt).toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      <div className={styles.incidentActionRow}>
                        {inc.status === 'OPEN' && (
                          <button
                            className={styles.ackBtn}
                            onClick={() => handleAck(inc.id)}
                            disabled={isAcking}
                            aria-label={`Acknowledge incident ${inc.title}`}
                          >
                            <Check size={13} />
                            <span>{isAcking ? 'Saving...' : 'Acknowledge'}</span>
                          </button>
                        )}
                        <button
                          className={styles.resolveBtn}
                          onClick={() => handleResolve(inc.id)}
                          disabled={isAcking}
                          aria-label={`Resolve incident ${inc.title}`}
                        >
                          <CheckCircle2 size={13} />
                          <span>{isAcking ? 'Saving...' : 'Resolve'}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Restored Probe Response Time History with Service Selector */}
          <section className={styles.panelCard} aria-label="Probe Response Time Telemetry">
            <div className={styles.panelHeader}>
              <div className={styles.panelHeaderLeft}>
                <div className={styles.graphTitleRow}>
                  <h3 className={styles.panelTitle}>Probe Response Time</h3>
                  {activeServiceLatency !== null && (
                    <span
                      className={`${styles.latestLatencyPill} ${
                        activeServiceLatency > 300
                          ? styles.latencyPillHigh
                          : activeServiceLatency > 100
                          ? styles.latencyPillMed
                          : styles.latencyPillNormal
                      }`}
                      title="Latest measured probe latency"
                    >
                      <span className={styles.statusDotSmall} />
                      {activeServiceLatency}ms
                    </span>
                  )}
                </div>
                <span className={styles.panelSubtitle}>
                  {activeService ? (
                    <>
                      <strong className={styles.serviceNameHighlight}>{activeService.name}</strong>
                      {timeRangeLabel ? ` · ${timeRangeLabel}` : ' · Trailing checks'}
                    </>
                  ) : (
                    'No services registered'
                  )}
                </span>
              </div>

              {services.length > 0 && (
                <div className={styles.graphControls}>
                  <select
                    id="overview-service-selector"
                    className={styles.serviceSelect}
                    value={activeService?.id ?? ''}
                    onChange={(e) => setSelectedGraphServiceId(e.target.value)}
                    aria-label="Select service for probe response time graph"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.environment})
                      </option>
                    ))}
                  </select>
                  {(isGraphLoading || isRefreshing) && (
                    <RefreshCw size={12} className={styles.spinning} style={{ color: 'var(--cp-text-muted)' }} />
                  )}
                </div>
              )}
            </div>

            <div className={styles.chartWrapper}>
              <LatencyChart checks={displayedChecks} compact={true} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
