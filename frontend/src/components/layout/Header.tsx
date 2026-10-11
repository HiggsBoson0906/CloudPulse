import React, { useEffect, useState } from 'react';
import { Clock, Key, RefreshCw, Sun, Moon } from 'lucide-react';
import styles from './Header.module.css';

/** Cloud-loop SVG logo matching the reference design */
function CloudLoopLogo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Cloud body */}
      <path
        d="M6.5 19C4.01 19 2 16.99 2 14.5C2 12.29 3.61 10.45 5.74 10.07C5.72 9.88 5.71 9.69 5.71 9.5C5.71 6.46 8.17 4 11.21 4C13.58 4 15.62 5.47 16.5 7.55C16.73 7.52 16.96 7.5 17.2 7.5C19.85 7.5 22 9.65 22 12.3C22 14.61 20.38 16.56 18.2 17.07"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Loop/infinity path inside cloud */}
      <path
        d="M9 16C9 16 8 14.5 9.5 13.5C11 12.5 13 13.5 13 15C13 16.5 15 17.5 16.5 16.5C18 15.5 17 14 17 14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface HeaderProps {
  activeIncidentsCount: number;
  hasDegradation?: boolean;
  autoRefreshInterval: number; // in seconds (0 = paused)
  onIntervalChange: (interval: number) => void;
  onManualRefresh: () => void;
  isRefreshing: boolean;
  hasApiKey: boolean;
  onOpenKeyModal: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
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
  theme,
  onToggleTheme,
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
          <CloudLoopLogo size={22} />
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

          <button
            className={styles.themeBtn}
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>
    </header>
  );
};
