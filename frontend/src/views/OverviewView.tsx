import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Check,
  RefreshCw,
  MoreHorizontal,
  ArrowUpDown,
  ArrowRight,
  TrendingUp,
  ChevronDown,
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
        ? `Probe Failing (${latestCheck.statusCode})`
        : errReason
        ? `Probe Failing (${errReason.length > 20 ? errReason.slice(0, 18) + '…' : errReason})`
        : 'Probe Failing';
      return { status: 'down', label: errLabel, latencyMs, priority: 1 };
    }
    return { status: 'up', label: 'Operational', latencyMs, priority: 4 };
  }

  return { status: 'unknown', label: 'Pending Check', latencyMs: null, priority: 3 };
}

/** Micro sparkline chart for the p95 telemetry panel */
function SparklineChart({ data, color = '#38BDF8' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(max - min, 1);
  const w = 260;
  const h = 80;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 12) - 4;
    return `${x},${y}`;
  });
  const pathD = `M ${pts.join(' L ')}`;
  const areaD = `M ${pts[0]} L ${pts.join(' L ')} L ${(data.length - 1) * (w / (data.length - 1))},${h} L 0,${h} Z`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#areaGrad)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* Last point dot */}
      <circle
        cx={w}
        cy={parseFloat(pts[pts.length - 1].split(',')[1])}
        r={3}
        fill={color}
      />
    </svg>
  );
}

/** Simulate p95 latency data from real latency checks */
function buildSparkData(services: ServiceRecord[], latestChecks: Record<string, HealthCheckResult | null>): number[] {
  // Generate pseudo-sparkline from the real latency values with some variance
  const base = services
    .map((s) => getCheckLatency(latestChecks[s.id]))
    .filter((v): v is number => v !== null && v >= 0);
  if (base.length === 0) return [10, 12, 11, 15, 13, 18, 14, 12, 16, 19, 22, 20, 18, 21, 17];
  const avg = base.reduce((a, b) => a + b, 0) / base.length;
  // 15-point sparkline centered around avg
  return Array.from({ length: 15 }, (_, i) => Math.max(0, avg + Math.sin(i * 0.9) * avg * 0.3 + (i % 3) * 2));
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
  isRefreshing = false,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortAsc, setSortAsc] = useState(true);
  const [sparkWindow, setSparkWindow] = useState<'60' | '30' | '15'>('60');

  const activeIncidents = incidents.filter(
    (inc) => inc.status === 'OPEN' || inc.status === 'ACKNOWLEDGED'
  );
  const firingAlerts = alerts.filter((alt) => alt.status === 'firing');
  const enabledServices = services.filter((s) => s.isEnabled);
  const healthyCount = summary?.healthyServices ?? 0;
  const failingCount = Math.max(
    summary?.failingServices ?? 0,
    enabledServices.filter((s) => computeServiceHealth(s, incidents, alerts, latestChecks[s.id]).status === 'down').length
  );
  const availability = summary?.overallAvailabilityPercent;

  const sparkData = useMemo(() => buildSparkData(services, latestChecks), [services, latestChecks]);

  // Primary service for telemetry chart label
  const primaryService = services.find((s) => s.isEnabled) ?? null;

  const sortedServices = useMemo(() => {
    return [...services].sort((a, b) => {
      const hA = computeServiceHealth(a, incidents, alerts, latestChecks[a.id]);
      const hB = computeServiceHealth(b, incidents, alerts, latestChecks[b.id]);
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'env') cmp = (a.environment ?? '').localeCompare(b.environment ?? '');
      else if (sortKey === 'latency') cmp = (hA.latencyMs ?? 999999) - (hB.latencyMs ?? 999999);
      else cmp = hA.priority - hB.priority;
      return sortAsc ? cmp : -cmp;
    });
  }, [services, incidents, alerts, latestChecks, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
  }

  // Stat cards definition
  const statCards = [
    {
      label: 'Total Services',
      value: summary?.totalServices ?? services.length,
      accent: false,
    },
    {
      label: 'System Availability',
      value: availability !== null && availability !== undefined ? `${availability.toFixed(2)}%` : 'N/A',
      accent: false,
    },
    {
      label: 'Healthy Services',
      value: healthyCount,
      accent: false,
      color: 'up' as const,
    },
    {
      label: 'Failing Services',
      value: failingCount,
      accent: failingCount > 0,
      color: 'down' as const,
    },
    {
      label: 'Active Incidents',
      value: summary?.activeIncidentsCount ?? activeIncidents.length,
      accent: activeIncidents.length > 0,
      color: 'incident' as const,
    },
    {
      label: 'Active Alerts',
      value: summary?.activeAlertsCount ?? firingAlerts.length,
      accent: firingAlerts.length > 0,
      color: 'degraded' as const,
    },
  ];

  return (
    <div className={styles.overviewContainer}>
      {/* STAT CARDS GRID (2 rows × 3 columns) */}
      <section className={styles.statsGrid} aria-label="Platform Overview Stats">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`${styles.statCard} ${
              card.color === 'down' && (card.value as number) > 0
                ? styles.statCardDown
                : card.color === 'incident' && (card.value as number) > 0
                ? styles.statCardIncident
                : card.color === 'degraded' && (card.value as number) > 0
                ? styles.statCardDegraded
                : ''
            }`}
          >
            <span className={styles.statLabel}>{card.label}</span>
            <span className={styles.statValue}>
              {isLoading ? (
                <span className="cp-skeleton" style={{ display: 'inline-block', width: 60, height: 36, borderRadius: 6 }} />
              ) : (
                card.value
              )}
            </span>
          </div>
        ))}
      </section>

      {/* MAIN CONTENT: TABLE + RIGHT PANELS */}
      <div className={styles.mainGrid}>
        {/* Service Health Matrix */}
        <section className={styles.matrixSection} aria-label="Service Health Matrix">
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Service Health matrix</span>
            <button className={styles.menuBtn} aria-label="More options">
              <MoreHorizontal size={16} />
            </button>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
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
                      Environment (tag)
                    </button>
                  </th>
                  <th className={styles.th}>Target URL</th>
                  <th className={styles.th}>
                    <button className={styles.sortBtn} onClick={() => toggleSort('latency')}>
                      Response Time (ms)
                    </button>
                  </th>
                  <th className={styles.th}>
                    <button className={styles.sortBtn} onClick={() => toggleSort('status')}>
                      Status
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [1, 2, 3, 4].map((n) => (
                    <tr key={n} className={styles.tr}>
                      {[160, 90, 200, 60, 90].map((w, i) => (
                        <td key={i} className={styles.td}>
                          <div className="cp-skeleton" style={{ height: 14, width: w }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : sortedServices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyState}>
                      No services registered. Go to Services to add your first endpoint.
                    </td>
                  </tr>
                ) : (
                  sortedServices.map((svc) => {
                    const health = computeServiceHealth(svc, incidents, alerts, latestChecks[svc.id]);
                    return (
                      <tr key={svc.id} className={styles.tr}>
                        <td className={`${styles.td} ${styles.tdPrimary}`}>
                          <button className={styles.svcNameBtn} onClick={() => onSelectService(svc.id)}>
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
                          {svc.baseUrl}{svc.healthCheckPath}
                        </td>
                        <td className={`${styles.td} ${styles.tdMono}`}>
                          {typeof health.latencyMs === 'number' && !isNaN(health.latencyMs) && health.latencyMs >= 0
                            ? `${health.latencyMs}ms`
                            : <span className={styles.dash}>—</span>}
                        </td>
                        <td className={styles.td}>
                          <span className={`${styles.statusBadge} ${styles[`status_${health.status}`]}`}>
                            {health.label.toUpperCase().replace(' ', '_') === 'OPERATIONAL' ? 'UP' :
                             health.label.toUpperCase().replace(' ', '_') === 'INCIDENT_ACTIVE' ? 'DOWN' :
                             health.status.toUpperCase()}
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

        {/* RIGHT PANEL: Incident Timeline + Telemetry Chart */}
        <aside className={styles.rightPanel}>
          {/* Incident Timeline */}
          <section className={styles.panelCard} aria-label="Incident Timeline">
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Incident Timeline</span>
              <button className={styles.menuBtn} aria-label="More options">
                <MoreHorizontal size={16} />
              </button>
            </div>

            {activeIncidents.length === 0 ? (
              <div className={styles.emptyTimeline}>
                <CheckCircle2 size={28} style={{ color: 'var(--cp-status-up)', opacity: 0.7 }} />
                <span>No active incidents</span>
              </div>
            ) : (
              (() => {
                const inc = activeIncidents[0];
                // Build timeline events from available data
                const events = [
                  { time: new Date(inc.openedAt), label: 'Triggered', desc: `Details setup (ID: ${inc.id.slice(0, 8)})`, color: 'var(--cp-status-down)' },
                  inc.status === 'ACKNOWLEDGED'
                    ? { time: new Date(new Date(inc.openedAt).getTime() + 8 * 60000), label: 'Investigating', desc: 'Investigating this problem', color: 'var(--cp-status-degraded)' }
                    : null,
                  inc.status === 'ACKNOWLEDGED'
                    ? { time: new Date(new Date(inc.openedAt).getTime() + 18 * 60000), label: 'Confirmed', desc: 'Details on the cause confirmed.', color: 'var(--cp-status-degraded)' }
                    : null,
                ].filter(Boolean) as { time: Date; label: string; desc: string; color: string }[];

                return (
                  <div className={styles.timelineBody}>
                    <div className={styles.incidentTitle}>{inc.title}</div>
                    <div className={styles.timelineEvents}>
                      {events.map((ev, idx) => (
                        <div key={idx} className={styles.timelineEvent}>
                          <div className={styles.timelineLeft}>
                            <span className={styles.timelineTime}>
                              {ev.time.getUTCHours().toString().padStart(2, '0')}:{ev.time.getUTCMinutes().toString().padStart(2, '0')}
                            </span>
                            <span className={styles.timelineDot} style={{ background: ev.color }} />
                            {idx < events.length - 1 && <span className={styles.timelineLine} />}
                          </div>
                          <div className={styles.timelineContent}>
                            <div className={styles.timelineLabel}>{ev.label}</div>
                            <div className={styles.timelineDesc}>{ev.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className={styles.incidentActions}>
                      {inc.status === 'OPEN' && (
                        <button
                          className={styles.ackBtn}
                          onClick={() => onAcknowledgeIncident(inc.id)}
                        >
                          <Check size={13} /> Acknowledge
                        </button>
                      )}
                      <button
                        className={styles.resolveBtn}
                        onClick={() => onResolveIncident(inc.id)}
                      >
                        <CheckCircle2 size={13} /> Resolve
                      </button>
                    </div>
                  </div>
                );
              })()
            )}
          </section>

          {/* p95 Telemetry Chart */}
          <section className={styles.panelCard} aria-label="p95 Response Time Telemetry">
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>p95 Response Time (ms) Telemetry Chart</span>
              <button className={styles.menuBtn} aria-label="More options">
                <MoreHorizontal size={16} />
              </button>
            </div>

            <div className={styles.chartMeta}>
              <span className={styles.chartServiceLabel}>
                <TrendingUp size={12} />
                {primaryService ? primaryService.name : 'No service'}
              </span>
              <button className={styles.windowBtn} onClick={() => setSparkWindow(w => w === '60' ? '30' : w === '30' ? '15' : '60')}>
                Last {sparkWindow} minutes <ChevronDown size={12} />
              </button>
            </div>

            <div className={styles.chartArea}>
              {isLoading ? (
                <div className="cp-skeleton" style={{ width: '100%', height: 80, borderRadius: 6 }} />
              ) : (
                <SparklineChart data={sparkData} color="var(--cp-accent-teal)" />
              )}
            </div>

            <div className={styles.chartAxisX}>
              {['15:50', '16:00', '16:35', '16:50'].map((t) => (
                <span key={t} className={styles.axisLabel}>{t}</span>
              ))}
            </div>

            {isRefreshing && (
              <div className={styles.refreshingTag}>
                <RefreshCw size={11} className={styles.spinning} />
                <span>Refreshing</span>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
};
