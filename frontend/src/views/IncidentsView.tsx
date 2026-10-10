import React, { useState } from 'react';
import { Check, CheckCircle2, Clock } from 'lucide-react';
import type { Incident, IncidentStatus } from '../types';
import styles from './IncidentsView.module.css';

interface IncidentsViewProps {
  incidents: Incident[];
  onAcknowledge: (id: string) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
  isLoading: boolean;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  incidents,
  onAcknowledge,
  onResolve,
  isLoading,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const filteredIncidents = incidents.filter((inc) => {
    if (selectedStatus === 'all') return true;
    return inc.status === (selectedStatus as IncidentStatus);
  });

  return (
    <div className={styles.container}>
      <div className={styles.controlsBar}>
        <div className={styles.statusTabs}>
          <button
            className={`${styles.tabBtn} ${selectedStatus === 'all' ? styles.tabBtnActive : ''}`}
            onClick={() => setSelectedStatus('all')}
          >
            All Incidents ({incidents.length})
          </button>
          <button
            className={`${styles.tabBtn} ${selectedStatus === 'OPEN' ? styles.tabBtnActive : ''}`}
            onClick={() => setSelectedStatus('OPEN')}
          >
            Open ({incidents.filter((i) => i.status === 'OPEN').length})
          </button>
          <button
            className={`${styles.tabBtn} ${selectedStatus === 'ACKNOWLEDGED' ? styles.tabBtnActive : ''}`}
            onClick={() => setSelectedStatus('ACKNOWLEDGED')}
          >
            Acknowledged ({incidents.filter((i) => i.status === 'ACKNOWLEDGED').length})
          </button>
          <button
            className={`${styles.tabBtn} ${selectedStatus === 'RESOLVED' ? styles.tabBtnActive : ''}`}
            onClick={() => setSelectedStatus('RESOLVED')}
          >
            Resolved ({incidents.filter((i) => i.status === 'RESOLVED').length})
          </button>
        </div>
      </div>

      <div className={styles.incidentsList}>
        {isLoading ? (
          <>
            {[1, 2].map((n) => (
              <div
                key={n}
                style={{
                  backgroundColor: 'var(--cp-bg-surface)',
                  border: '1px solid var(--cp-border-subtle)',
                  borderRadius: 'var(--cp-radius-md)',
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="cp-skeleton" style={{ height: '22px', width: '260px' }} />
                  <div className="cp-skeleton" style={{ height: '32px', width: '100px' }} />
                </div>
                <div className="cp-skeleton" style={{ height: '16px', width: '80%' }} />
                <div className="cp-skeleton" style={{ height: '14px', width: '40%' }} />
              </div>
            ))}
          </>
        ) : filteredIncidents.length === 0 ? (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              backgroundColor: 'var(--cp-bg-surface)',
              borderRadius: '8px',
              border: '1px solid var(--cp-border-subtle)',
              color: 'var(--cp-text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={24} style={{ color: 'var(--cp-status-up)' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--cp-text-primary)' }}>
              Zero Incidents Active
            </span>
            <span style={{ fontSize: '12px' }}>
              No incidents matching the selected status filter. System stability is nominal.
            </span>
          </div>
        ) : (
          filteredIncidents.map((inc) => (
            <article key={inc.id} className={styles.incidentCard}>
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
                  <h3 className={styles.title}>{inc.title}</h3>
                </div>

                <div className={styles.actions}>
                  {inc.status === 'OPEN' && (
                    <button
                      className={`${styles.actionBtn} ${styles.ackBtn}`}
                      onClick={() => onAcknowledge(inc.id)}
                      aria-label={`Acknowledge incident "${inc.title}"`}
                    >
                      <Check size={14} /> Acknowledge
                    </button>
                  )}
                  {inc.status !== 'RESOLVED' && (
                    <button
                      className={`${styles.actionBtn} ${styles.resolveBtn}`}
                      onClick={() => onResolve(inc.id)}
                      aria-label={`Resolve incident "${inc.title}"`}
                    >
                      <CheckCircle2 size={14} /> Resolve
                    </button>
                  )}
                </div>
              </div>

              {inc.summary && (
                <div className={styles.summaryWell}>
                  {inc.summary}
                </div>
              )}

              <div className={styles.timelineRow}>
                <div className={styles.timelineItem}>
                  <Clock size={13} />
                  <span>Opened: {new Date(inc.openedAt).toLocaleString()}</span>
                </div>

                {inc.acknowledgedAt && (
                  <div className={styles.timelineItem}>
                    <Check size={13} style={{ color: 'var(--cp-incident-ack)' }} />
                    <span>Acknowledged: {new Date(inc.acknowledgedAt).toLocaleTimeString()}</span>
                  </div>
                )}

                {inc.resolvedAt && (
                  <div className={styles.timelineItem}>
                    <CheckCircle2 size={13} style={{ color: 'var(--cp-status-up)' }} />
                    <span>Resolved: {new Date(inc.resolvedAt).toLocaleTimeString()}</span>
                  </div>
                )}

                <div className={styles.timelineItem} style={{ marginLeft: 'auto' }}>
                  <span className="mono">ID: {inc.id}</span>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};
