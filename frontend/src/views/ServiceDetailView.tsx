import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { getCheckError, getCheckLatency, type HealthCheckResult, type MetricWindow, type ServiceMetrics, type ServiceRecord } from '../types';
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
          api.getServiceMetrics(serviceId, selectedWindow),
          api.getServiceChecks(serviceId, 50),
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
          <ArrowLeft size={14} /> Back to Services
        </button>
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--cp-text-muted)' }}>
          Service with ID &apos;{serviceId}&apos; not found.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerBar}>
        <div className={styles.leftHeader}>
          <button className={styles.backBtn} onClick={onBack}>
            <ArrowLeft size={14} /> Services
          </button>
          <div className={styles.serviceTitle}>
            <span>{service.name}</span>
            <span
              className="mono"
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                color: '#38BDF8',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                textTransform: 'uppercase',
              }}
            >
              {service.environment}
            </span>
          </div>
        </div>

        <div className={styles.windowTabs}>
          <button
            className={`${styles.tabBtn} ${selectedWindow === '15m' ? styles.tabBtnActive : ''}`}
            onClick={() => setSelectedWindow('15m')}
          >
            15m Window
          </button>
          <button
            className={`${styles.tabBtn} ${selectedWindow === '1h' ? styles.tabBtnActive : ''}`}
            onClick={() => setSelectedWindow('1h')}
          >
            1h Window
          </button>
          <button
            className={`${styles.tabBtn} ${selectedWindow === '24h' ? styles.tabBtnActive : ''}`}
            onClick={() => setSelectedWindow('24h')}
          >
            24h Window
          </button>
        </div>
      </div>

      {/* Telemetry Metrics Quad */}
      <section className={styles.telemetryGrid} aria-label="Aggregated Metrics">
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Availability</span>
          <div className={styles.metricValue}>
            {metrics?.availabilityPercent !== null && metrics?.availabilityPercent !== undefined ? (
              <span>{metrics.availabilityPercent.toFixed(2)}%</span>
            ) : (
              <span style={{ color: 'var(--cp-text-muted)' }}>N/A</span>
            )}
          </div>
          <span className={styles.metricUnit}>
            {metrics?.successCount ?? 0} pass / {metrics?.totalChecks ?? 0} total
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Error Rate</span>
          <div className={styles.metricValue}>
            <span style={{ color: (metrics?.errorRatePercent ?? 0) > 0 ? 'var(--cp-status-down)' : 'inherit' }}>
              {(metrics?.errorRatePercent ?? 0).toFixed(2)}%
            </span>
          </div>
          <span className={styles.metricUnit}>{metrics?.failureCount ?? 0} failed checks</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>P95 Latency</span>
          <div className={styles.metricValue}>
            {metrics?.p95LatencyMs !== null && metrics?.p95LatencyMs !== undefined ? (
              <span>{metrics.p95LatencyMs}ms</span>
            ) : (
              <span style={{ color: 'var(--cp-text-muted)' }}>N/A</span>
            )}
          </div>
          <span className={styles.metricUnit}>Avg: {metrics?.avgLatencyMs ? `${metrics.avgLatencyMs.toFixed(1)}ms` : 'N/A'}</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>P99 Latency</span>
          <div className={styles.metricValue}>
            {metrics?.p99LatencyMs !== null && metrics?.p99LatencyMs !== undefined ? (
              <span>{metrics.p99LatencyMs}ms</span>
            ) : (
              <span style={{ color: 'var(--cp-text-muted)' }}>N/A</span>
            )}
          </div>
          <span className={styles.metricUnit}>Tail threshold latency</span>
        </div>
      </section>

      {/* Latency Telemetry Chart */}
      <section className={styles.chartSection} aria-label="Probe Latency Chart">
        <div className={styles.chartHeader}>
          <h3 className={styles.chartTitle}>Recent Probe Response Times (Trailing 50 checks)</h3>
          <span className="mono" style={{ fontSize: '11px', color: 'var(--cp-text-muted)' }}>
            Target: {service.baseUrl}{service.healthCheckPath}
          </span>
        </div>

        <LatencyChart checks={checks} />
      </section>

      {/* Chronological Probe Audit Log Table */}
      <section className={styles.tableSection} aria-label="Recent Check Results">
        <div className={styles.sectionHeader}>
          <h3 className={styles.chartTitle}>Chronological Probe Execution History</h3>
          <span className="mono" style={{ fontSize: '11px', color: 'var(--cp-text-muted)' }}>
            Showing {checks.length} recent audit samples
          </span>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Check Timestamp</th>
                <th className={styles.th}>Result</th>
                <th className={styles.th}>HTTP Status</th>
                <th className={styles.th}>Latency</th>
                <th className={styles.th}>Diagnostics / Error</th>
              </tr>
            </thead>
            <tbody>
              {checks.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: 'var(--cp-text-muted)' }}>
                    {isLoading ? 'Loading check audit history...' : 'No checks recorded yet.'}
                  </td>
                </tr>
              ) : (
                checks.map((c) => (
                  <tr key={c.id} className={styles.tr}>
                    <td className={`${styles.td} mono`}>
                      {new Date(c.checkTimestamp).toLocaleString()}
                    </td>
                    <td className={styles.td}>
                      {c.isSuccess ? (
                        <span style={{ color: 'var(--cp-status-up)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <CheckCircle size={13} /> SUCCESS
                        </span>
                      ) : (
                        <span style={{ color: 'var(--cp-status-down)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <XCircle size={13} /> FAILURE
                        </span>
                      )}
                    </td>
                    <td className={`${styles.td} mono`}>
                      {c.statusCode ? (
                        <span style={{ color: c.statusCode < 400 ? 'var(--cp-status-up)' : 'var(--cp-status-down)' }}>
                          {c.statusCode}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--cp-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className={`${styles.td} mono`}>
                      {getCheckLatency(c) !== null ? `${getCheckLatency(c)}ms` : '—'}
                    </td>
                    <td className={styles.td}>
                      {getCheckError(c) ? (
                        <span style={{ color: 'var(--cp-status-down)', fontSize: '12px' }}>
                          {getCheckError(c)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--cp-text-muted)' }}>OK</span>
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
