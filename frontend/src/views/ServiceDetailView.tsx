import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Globe,
  Settings,
} from 'lucide-react';
import {
  getCheckError,
  getCheckLatency,
  type HealthCheckResult,
  type MetricWindow,
  type ServiceMetrics,
  type ServiceRecord,
} from '../types';
import { api } from '../api/client';
import { LatencyChart } from '../components/telemetry/LatencyChart';
import styles from './ServiceDetailView.module.css';

interface ServiceDetailViewProps {
  serviceId: string;
  services: ServiceRecord[];
  onBack: () => void;
}

export const ServiceDetailView: React.FC<ServiceDetailViewProps> = ({
  serviceId,
  services,
  onBack,
}) => {
  const service = services.find((s) => s.id === serviceId);
  const [selectedWindow, setSelectedWindow] = useState<MetricWindow>('15m');
  const [metrics, setMetrics] = useState<ServiceMetrics | null>(null);
  const [checks, setChecks] = useState<HealthCheckResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setIsLoading(true);
      try {
        const [metricsData, checksData] = await Promise.all([
          api.getServiceMetrics(serviceId, selectedWindow).catch(() => null),
          api.getServiceChecks(serviceId, 50).catch(() => []),
        ]);
        if (!ignore) {
          setMetrics(metricsData);
          setChecks(checksData);
        }
      } catch (err: unknown) {
        console.error('Failed to fetch service detail telemetry:', err);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [serviceId, selectedWindow]);

  if (!service) {
    return (
      <div className={styles.container}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={15} /> <span>Back to Services</span>
        </button>
        <div className={styles.notFoundState}>
          <Activity size={32} style={{ color: 'var(--cp-text-muted)' }} />
          <span>Service not found in monitoring registry.</span>
        </div>
      </div>
    );
  }

  const latestCheck = checks.length > 0 ? checks[0] : null;

  return (
    <div className={styles.container}>
      {/* Back button and navigation breadcrumb */}
      <div className={styles.breadcrumbBar}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Return to Services">
          <ArrowLeft size={15} />
          <span>Services</span>
        </button>
        <span className={styles.breadcrumbDivider}>/</span>
        <span className={styles.breadcrumbCurrent}>{service.name}</span>
      </div>

      {/* Service Hero Header */}
      <div className={styles.headerBar}>
        <div className={styles.serviceHero}>
          <div className={styles.titleRow}>
            <h1 className={styles.serviceTitle}>{service.name}</h1>
            <span
              className={`${styles.envBadge} ${
                service.environment === 'production'
                  ? styles.envProd
                  : service.environment === 'staging'
                  ? styles.envStaging
                  : styles.envDev
              }`}
            >
              {service.environment}
            </span>
            {latestCheck && (
              <span
                className={`${styles.healthPill} ${
                  latestCheck.isSuccess ? styles.healthPillUp : styles.healthPillDown
                }`}
              >
                {latestCheck.isSuccess ? (
                  <>
                    <CheckCircle size={13} /> OPERATIONAL
                  </>
                ) : (
                  <>
                    <XCircle size={13} /> PROBE FAILING
                  </>
                )}
              </span>
            )}
          </div>

          <div className={styles.metaRow}>
            <span className={styles.metaItem}>
              <Globe size={14} />
              <span className="mono">{service.baseUrl}{service.healthCheckPath}</span>
            </span>
            <span className={styles.metaDot}>•</span>
            <span className={styles.metaItem}>
              <Clock size={14} />
              <span>Interval: {service.checkIntervalSeconds}s · Timeout: {service.timeoutMs}ms</span>
            </span>
            <span className={styles.metaDot}>•</span>
            <span className={styles.metaItem}>
              <Settings size={14} />
              <span>{service.isEnabled ? 'Active Probing' : 'Probing Paused'}</span>
            </span>
          </div>
        </div>

        {/* Time Window Tabs */}
        <div className={styles.windowTabs} role="tablist" aria-label="Select Telemetry Aggregation Window">
          <button
            className={`${styles.tabBtn} ${selectedWindow === '15m' ? styles.tabBtnActive : ''}`}
            onClick={() => setSelectedWindow('15m')}
            role="tab"
            aria-selected={selectedWindow === '15m'}
          >
            15m Window
          </button>
          <button
            className={`${styles.tabBtn} ${selectedWindow === '1h' ? styles.tabBtnActive : ''}`}
            onClick={() => setSelectedWindow('1h')}
            role="tab"
            aria-selected={selectedWindow === '1h'}
          >
            1h Window
          </button>
          <button
            className={`${styles.tabBtn} ${selectedWindow === '24h' ? styles.tabBtnActive : ''}`}
            onClick={() => setSelectedWindow('24h')}
            role="tab"
            aria-selected={selectedWindow === '24h'}
          >
            24h Window
          </button>
        </div>
      </div>

      {/* Telemetry Metrics Quad */}
      <section className={styles.telemetryGrid} aria-label="Aggregated Metrics">
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Window Availability</span>
          <div className={styles.metricValue}>
            {isLoading ? (
              <span className="cp-skeleton" style={{ width: 80, height: 32, borderRadius: 6 }} />
            ) : metrics?.availabilityPercent !== null && metrics?.availabilityPercent !== undefined ? (
              <span>{metrics.availabilityPercent.toFixed(2)}%</span>
            ) : (
              <span style={{ color: 'var(--cp-text-muted)' }}>N/A</span>
            )}
          </div>
          <span className={styles.metricUnit}>
            {metrics ? `${metrics.successCount} pass / ${metrics.totalChecks} checks` : 'Awaiting data'}
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Error Rate</span>
          <div className={styles.metricValue}>
            {isLoading ? (
              <span className="cp-skeleton" style={{ width: 80, height: 32, borderRadius: 6 }} />
            ) : metrics ? (
              <span style={{ color: metrics.errorRatePercent > 0 ? 'var(--cp-status-down)' : 'inherit' }}>
                {metrics.errorRatePercent.toFixed(2)}%
              </span>
            ) : (
              <span style={{ color: 'var(--cp-text-muted)' }}>N/A</span>
            )}
          </div>
          <span className={styles.metricUnit}>
            {metrics ? `${metrics.failureCount} failed probes` : 'Awaiting data'}
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>P95 Latency</span>
          <div className={styles.metricValue}>
            {isLoading ? (
              <span className="cp-skeleton" style={{ width: 80, height: 32, borderRadius: 6 }} />
            ) : metrics?.p95LatencyMs !== null && metrics?.p95LatencyMs !== undefined ? (
              <span>{metrics.p95LatencyMs}ms</span>
            ) : (
              <span style={{ color: 'var(--cp-text-muted)' }}>N/A</span>
            )}
          </div>
          <span className={styles.metricUnit}>
            Avg: {metrics?.avgLatencyMs ? `${metrics.avgLatencyMs.toFixed(1)}ms` : 'N/A'}
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>P99 Tail Latency</span>
          <div className={styles.metricValue}>
            {isLoading ? (
              <span className="cp-skeleton" style={{ width: 80, height: 32, borderRadius: 6 }} />
            ) : metrics?.p99LatencyMs !== null && metrics?.p99LatencyMs !== undefined ? (
              <span>{metrics.p99LatencyMs}ms</span>
            ) : (
              <span style={{ color: 'var(--cp-text-muted)' }}>N/A</span>
            )}
          </div>
          <span className={styles.metricUnit}>99th percentile response time</span>
        </div>
      </section>

      {/* Latency Telemetry Chart */}
      <section className={styles.chartSection} aria-label="Probe Latency Chart">
        <div className={styles.chartHeader}>
          <div>
            <h2 className={styles.chartTitle}>Recent Probe Response Times</h2>
            <p className={styles.chartSubtitle}>
              Trailing 50 health checks recorded for {service.name}
            </p>
          </div>
          <span className={styles.chartTargetTag}>
            Target: <strong className="mono">{service.baseUrl}{service.healthCheckPath}</strong>
          </span>
        </div>

        <LatencyChart checks={checks} />
      </section>

      {/* Chronological Probe History Table */}
      <section className={styles.tableSection} aria-label="Recent Check Results">
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.chartTitle}>Chronological Probe Execution History</h2>
            <p className={styles.chartSubtitle}>
              Detailed audit trail of response codes, latency measurements, and error diagnostics
            </p>
          </div>
          <span className={styles.sampleCountTag}>
            Showing {checks.length} recent executions
          </span>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Execution Timestamp</th>
                <th className={styles.th}>Result</th>
                <th className={styles.th}>HTTP Status</th>
                <th className={styles.th}>Latency</th>
                <th className={styles.th}>Diagnostic Output / Error Reason</th>
              </tr>
            </thead>
            <tbody>
              {checks.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyTable}>
                    {isLoading ? 'Loading check audit history...' : 'Zero probe checks recorded for this service yet.'}
                  </td>
                </tr>
              ) : (
                checks.map((c) => (
                  <tr key={c.id} className={styles.tr}>
                    <td className={`${styles.td} ${styles.tdMono}`}>
                      {new Date(c.checkTimestamp).toLocaleString()}
                    </td>
                    <td className={styles.td}>
                      {c.isSuccess ? (
                        <span className={styles.successPill}>
                          <CheckCircle size={14} /> SUCCESS
                        </span>
                      ) : (
                        <span className={styles.failPill}>
                          <XCircle size={14} /> FAILURE
                        </span>
                      )}
                    </td>
                    <td className={`${styles.td} ${styles.tdMono}`}>
                      {c.statusCode ? (
                        <span
                          className={
                            c.statusCode < 400 ? styles.statusNormal : styles.statusError
                          }
                        >
                          HTTP {c.statusCode}
                        </span>
                      ) : (
                        <span className={styles.dash}>—</span>
                      )}
                    </td>
                    <td className={`${styles.td} ${styles.tdMono}`}>
                      {getCheckLatency(c) !== null ? `${getCheckLatency(c)}ms` : '—'}
                    </td>
                    <td className={styles.td}>
                      {getCheckError(c) ? (
                        <span className={styles.errorDiagnostic}>
                          {getCheckError(c)}
                        </span>
                      ) : (
                        <span className={styles.okDiagnostic}>Probe passed cleanly</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
