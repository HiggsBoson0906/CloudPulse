import React, { useEffect, useState } from 'react';
import { Activity, Clock, Key, RefreshCw } from 'lucide-react';
import styles from './Header.module.css';

interface HeaderProps {
  activeIncidentsCount: number;
  hasDegradation?: boolean;
  autoRefreshInterval: number; // in seconds (0 = paused)
  onIntervalChange: (interval: number) => void;
  onManualRefresh: () => void;
  isRefreshing: boolean;
  hasApiKey: boolean;
  onOpenKeyModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeIncidentsCount,
  hasDegradation = false,
  autoRefreshInterval,
  onIntervalChange,
  onManualRefresh,
  isRefreshing,
  hasApiKey,
  onOpenKeyModal,
}) => {
  const [utcTime, setUtcTime] = useState<string>('');

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const mins = String(now.getUTCMinutes()).padStart(2, '0');
      const secs = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${hours}:${mins}:${secs} UTC`);
    }

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        <div className={styles.brand}>
          <Activity size={20} className={styles.logoIcon} />
          <span>CloudPulse</span>
        </div>

        {activeIncidentsCount > 0 ? (
          <div className={`${styles.statusPill} ${styles.statusIncident}`}>
            <span className={styles.statusDot} />
            <span>{activeIncidentsCount} Active Incident{activeIncidentsCount > 1 ? 's' : ''}</span>
          </div>
        ) : hasDegradation ? (
          <div className={`${styles.statusPill} ${styles.statusDegraded}`}>
            <span className={styles.statusDot} />
            <span>Service Degradation</span>
          </div>
        ) : (
          <div className={`${styles.statusPill} ${styles.statusOperational}`}>
            <span className={styles.statusDot} />
            <span>System Operational</span>
          </div>
        )}
      </div>

      <div className={styles.rightSection}>
        <div className={styles.clock}>
          <Clock size={13} />
          <span>{utcTime}</span>
        </div>

        <div className={styles.refreshControls}>
          <select
            className={styles.refreshSelect}
            value={autoRefreshInterval}
            onChange={(e) => onIntervalChange(Number(e.target.value))}
            aria-label="Auto-refresh rate"
          >
            <option value={5}>Poll: 5s</option>
            <option value={15}>Poll: 15s (Default)</option>
            <option value={30}>Poll: 30s</option>
            <option value={0}>Paused</option>
          </select>

          <button
            className={styles.refreshBtn}
            onClick={onManualRefresh}
            disabled={isRefreshing}
            title="Refresh now"
            aria-label="Refresh telemetry data"
          >
            <RefreshCw size={13} className={isRefreshing ? styles.spinning : ''} />
            <span>Refresh</span>
          </button>

          <button
            className={styles.keyBtn}
            onClick={onOpenKeyModal}
            title={hasApiKey ? 'API Key Configured (Click to change)' : 'API Key Missing (Click to configure)'}
            aria-label="Manage API Authentication Key"
          >
            <Key size={13} />
            <span>{hasApiKey ? 'Key Active' : 'Set API Key'}</span>
            <span className={hasApiKey ? styles.keyDotActive : styles.keyDotMissing} />
          </button>
        </div>
      </div>
    </header>
  );
};
