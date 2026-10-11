import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Server,
  Hash,
  Search,
} from 'lucide-react';
import type { Incident, IncidentStatus, ServiceRecord } from '../types';
import styles from './IncidentsView.module.css';

interface IncidentsViewProps {
  incidents: Incident[];
  services?: ServiceRecord[];
  onAcknowledge: (id: string) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
  isLoading: boolean;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  incidents,
  services = [],
  onAcknowledge,
  onResolve,
  isLoading,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const openIncidents = incidents.filter((i) => i.status === 'OPEN');
  const ackIncidents = incidents.filter((i) => i.status === 'ACKNOWLEDGED');
  const resolvedIncidents = incidents.filter((i) => i.status === 'RESOLVED');

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const matchesStatus =
        selectedStatus === 'all' || inc.status === (selectedStatus as IncidentStatus);
      if (!matchesStatus) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const targetSvc = services.find((s) => s.id === inc.serviceId);
      const svcName = targetSvc ? targetSvc.name.toLowerCase() : '';
      return (
        inc.title.toLowerCase().includes(q) ||
        (inc.summary && inc.summary.toLowerCase().includes(q)) ||
        svcName.includes(q) ||
        inc.id.toLowerCase().includes(q)
      );
    });
  }, [incidents, selectedStatus, searchQuery, services]);

  async function handleAck(id: string) {
    try {
      setActionInProgress(id);
      await onAcknowledge(id);
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleResolve(id: string) {
    try {
      setActionInProgress(id);
      await onResolve(id);
    } finally {
      setActionInProgress(null);
    }
  }

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Incident Management</h1>
          <p className={styles.pageSubtitle}>
            Triage operational outages, acknowledge firing alerts, and resolve system incidents.
          </p>
        </div>
      </div>

      {/* Operational Summary Strip */}
      <div className={styles.summaryStrip}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Open Incidents</span>
          <span className={`${styles.summaryVal} ${openIncidents.length > 0 ? styles.summaryDown : styles.summaryUp}`}>
            {openIncidents.length}
          </span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Acknowledged</span>
          <span className={`${styles.summaryVal} ${ackIncidents.length > 0 ? styles.summaryAck : ''}`}>
            {ackIncidents.length}
          </span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Resolved History</span>
          <span className={styles.summaryVal}>{resolvedIncidents.length}</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Tracked</span>
          <span className={styles.summaryVal}>{incidents.length}</span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className={styles.controlsBar}>
        <div className={styles.statusTabs} role="tablist" aria-label="Filter incidents by status">
          <button
            className={`${styles.tabBtn} ${selectedStatus === 'all' ? styles.tabBtnActive : ''}`}
            onClick={() => setSelectedStatus('all')}
            role="tab"
            aria-selected={selectedStatus === 'all'}
          >
            All Incidents ({incidents.length})
          </button>
          <button
            className={`${styles.tabBtn} ${selectedStatus === 'OPEN' ? styles.tabBtnActive : ''}`}
            onClick={() => setSelectedStatus('OPEN')}
            role="tab"
            aria-selected={selectedStatus === 'OPEN'}
          >
            Open ({openIncidents.length})
          </button>
          <button
            className={`${styles.tabBtn} ${selectedStatus === 'ACKNOWLEDGED' ? styles.tabBtnActive : ''}`}
            onClick={() => setSelectedStatus('ACKNOWLEDGED')}
            role="tab"
            aria-selected={selectedStatus === 'ACKNOWLEDGED'}
          >
            Acknowledged ({ackIncidents.length})
          </button>
          <button
            className={`${styles.tabBtn} ${selectedStatus === 'RESOLVED' ? styles.tabBtnActive : ''}`}
            onClick={() => setSelectedStatus('RESOLVED')}
            role="tab"
            aria-selected={selectedStatus === 'RESOLVED'}
          >
            Resolved ({resolvedIncidents.length})
          </button>
        </div>

        <div className={styles.searchWrapper}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search incident title, service, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search incidents"
          />
        </div>
      </div>

      {/* Incidents Feed */}
      <div className={styles.incidentsList}>
        {isLoading ? (
          [1, 2].map((n) => (
            <div key={n} className={styles.skeletonCard}>
              <div className={styles.skeletonHeader}>
                <div className="cp-skeleton" style={{ height: 26, width: 280 }} />
                <div className="cp-skeleton" style={{ height: 34, width: 120 }} />
              </div>
              <div className="cp-skeleton" style={{ height: 18, width: '75%' }} />
              <div className="cp-skeleton" style={{ height: 16, width: '45%' }} />
            </div>
          ))
        ) : filteredIncidents.length === 0 ? (
          <div className={styles.emptyState}>
            <ShieldCheck size={36} className={styles.emptyIcon} />
            <span className={styles.emptyTitle}>
              {selectedStatus === 'all'
                ? 'Zero Incident Records Found'
                : `Zero Incidents Matching Status "${selectedStatus}"`}
            </span>
            <span className={styles.emptySubtitle}>
              All monitored infrastructure services are stable and performing within SLA parameters.
            </span>
          </div>
        ) : (
          filteredIncidents.map((inc) => {
            const targetSvc = services.find((s) => s.id === inc.serviceId);
            const isActing = actionInProgress === inc.id;

            return (
              <article
                key={inc.id}
                className={`${styles.incidentCard} ${
                  inc.status === 'OPEN'
                    ? styles.cardOpen
                    : inc.status === 'ACKNOWLEDGED'
                    ? styles.cardAck
                    : styles.cardResolved
                }`}
              >
                <div className={styles.cardTop}>
                  <div className={styles.titleArea}>
                    <span
                      className={`${styles.statusPill} ${
                        inc.status === 'OPEN'
                          ? styles.statusOpen
                          : inc.status === 'ACKNOWLEDGED'
                          ? styles.statusAck
                          : styles.statusResolved
                      }`}
                    >
                      {inc.status}
                    </span>

                    {inc.severity && (
                      <span
                        className={`${styles.sevBadge} ${
                          inc.severity === 'critical'
                            ? styles.sevCritical
                            : inc.severity === 'high'
                            ? styles.sevHigh
                            : inc.severity === 'medium'
                            ? styles.sevMedium
                            : styles.sevLow
                        }`}
                      >
                        {inc.severity}
                      </span>
                    )}

                    <h2 className={styles.title}>{inc.title}</h2>
                  </div>

                  <div className={styles.actions}>
                    {inc.status === 'OPEN' && (
                      <button
                        className={`${styles.actionBtn} ${styles.ackBtn}`}
                        onClick={() => handleAck(inc.id)}
                        disabled={isActing}
                        aria-label={`Acknowledge incident "${inc.title}"`}
                      >
                        <Check size={14} />
                        <span>{isActing ? 'Saving...' : 'Acknowledge'}</span>
                      </button>
                    )}
                    {inc.status !== 'RESOLVED' && (
                      <button
                        className={`${styles.actionBtn} ${styles.resolveBtn}`}
                        onClick={() => handleResolve(inc.id)}
                        disabled={isActing}
                        aria-label={`Resolve incident "${inc.title}"`}
                      >
                        <CheckCircle2 size={14} />
                        <span>{isActing ? 'Saving...' : 'Resolve'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {targetSvc && (
                  <div className={styles.affectedServiceRow}>
                    <Server size={14} className={styles.serviceIcon} />
                    <span>
                      Affected Service: <strong className="mono">{targetSvc.name}</strong> ({targetSvc.environment})
                    </span>
                  </div>
                )}

                {inc.summary && (
                  <div className={styles.summaryWell}>
                    {inc.summary}
                  </div>
                )}

                <div className={styles.timelineRow}>
                  <div className={styles.timelineItem}>
                    <Clock size={13} />
                    <span>Triggered: {new Date(inc.openedAt).toLocaleString()}</span>
                  </div>

                  {inc.acknowledgedAt && (
                    <div className={styles.timelineItem}>
                      <Check size={13} style={{ color: 'var(--cp-incident-ack)' }} />
                      <span>Acknowledged: {new Date(inc.acknowledgedAt).toLocaleString()}</span>
                    </div>
                  )}

                  {inc.resolvedAt && (
                    <div className={styles.timelineItem}>
                      <CheckCircle2 size={13} style={{ color: 'var(--cp-status-up)' }} />
                      <span>Resolved: {new Date(inc.resolvedAt).toLocaleString()}</span>
                    </div>
                  )}

                  <div className={styles.idItem}>
                    <Hash size={12} />
                    <span className="mono">{inc.id}</span>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};
