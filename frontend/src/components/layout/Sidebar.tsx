import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Server,
  BellRing,
  AlertOctagon,
  ShieldCheck,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import styles from './Sidebar.module.css';

export type TabId = 'overview' | 'services' | 'alerts' | 'incidents';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  activeIncidentsCount: number;
  activeAlertsCount: number;
  healthyServicesCount: number;
  failingServicesCount: number;
  totalServicesCount: number;
  hasDegradation?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const NAV_ITEMS = [
  { id: 'overview' as TabId, label: 'Overview', Icon: LayoutDashboard, shortcut: 'Alt+1' },
  { id: 'services' as TabId, label: 'Services', Icon: Server, shortcut: 'Alt+2' },
  { id: 'alerts' as TabId, label: 'Alert Rules', Icon: BellRing, shortcut: 'Alt+3' },
  { id: 'incidents' as TabId, label: 'Incidents', Icon: AlertOctagon, shortcut: 'Alt+4' },
] as const;

/** CloudLoop Logo component for the top Discord-style brand button */
function CloudLoopLogo({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6.5 19C4.01 19 2 16.99 2 14.5C2 12.29 3.61 10.45 5.74 10.07C5.72 9.88 5.71 9.69 5.71 9.5C5.71 6.46 8.17 4 11.21 4C13.58 4 15.62 5.47 16.5 7.55C16.73 7.52 16.96 7.5 17.2 7.5C19.85 7.5 22 9.65 22 12.3C22 14.61 20.38 16.56 18.2 17.07"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 16C9 16 8 14.5 9.5 13.5C11 12.5 13 13.5 13 15C13 16.5 15 17.5 16.5 16.5C18 15.5 17 14 17 14"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  activeIncidentsCount,
  activeAlertsCount,
  healthyServicesCount,
  failingServicesCount,
  totalServicesCount,
  hasDegradation = false,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  // Persisted expand/collapse preference (default to compact rail)
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('expanded') === 'true') return true;
      if (params.get('expanded') === 'false') return false;
    }
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('cloudpulse_nav_expanded');
      if (saved !== null) return saved === 'true';
    }
    return false;
  });

  const isIncident = activeIncidentsCount > 0;
  const isDegraded = !isIncident && (hasDegradation || failingServicesCount > 0);

  useEffect(() => {
    try {
      localStorage.setItem('cloudpulse_nav_expanded', String(isExpanded));
    } catch {
      // Ignore storage errors
    }
  }, [isExpanded]);

  function getBadgeCount(id: TabId): number {
    if (id === 'alerts') return activeAlertsCount;
    if (id === 'incidents') return activeIncidentsCount;
    return 0;
  }

  function handleSelect(id: TabId) {
    onTabChange(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  }

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className={styles.mobileBackdrop}
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`${styles.rail} ${isExpanded ? styles.railExpanded : styles.railCompact} ${
          isMobileOpen ? styles.railMobileOpen : ''
        }`}
        aria-label="Application Navigation Rail"
      >
        {/* Top: Discord-style Brand Squircle Button */}
        <div className={styles.brandContainer}>
          <button
            className={`${styles.brandBtn} ${activeTab === 'overview' ? styles.brandBtnActive : ''}`}
            onClick={() => handleSelect('overview')}
            title="CloudPulse — Observability Home"
            aria-label="CloudPulse Home"
          >
            <span className={styles.activePill} aria-hidden="true" />
            <div className={styles.brandSquircle}>
              <CloudLoopLogo size={22} />
            </div>
            {isExpanded && (
              <div className={styles.brandLabelGroup}>
                <span className={styles.brandTitle}>CloudPulse</span>
                <span className={styles.brandSubtitle}>Observability</span>
              </div>
            )}
          </button>

          {isMobileOpen && (
            <button
              className={styles.mobileCloseBtn}
              onClick={onCloseMobile}
              aria-label="Close Navigation"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Discord-style Rail Divider */}
        <div className={styles.railDivider} role="separator" />

        {/* Navigation Destinations Stack */}
        <nav className={styles.navStack} aria-label="Primary Destinations">
          {NAV_ITEMS.map(({ id, label, Icon, shortcut }) => {
            const badge = getBadgeCount(id);
            const isActive = activeTab === id;

            return (
              <div key={id} className={styles.navItemWrapper}>
                <button
                  className={`${styles.navItemBtn} ${isActive ? styles.navItemActive : ''}`}
                  onClick={() => handleSelect(id)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={`${label} (${shortcut})`}
                >
                  {/* Discord Left-Edge Indicator Pill */}
                  <span className={styles.activePill} aria-hidden="true" />

                  {/* Icon Squircle with notification badge */}
                  <div className={styles.iconSquircle}>
                    <Icon size={20} className={styles.navIcon} />
                    {badge > 0 && (
                      <span
                        className={`${styles.badgeDot} ${
                          id === 'incidents' ? styles.badgeDown : styles.badgeDegraded
                        }`}
                        title={`${badge} active`}
                      >
                        {badge}
                      </span>
                    )}
                  </div>

                  {/* Expanded Mode: Destination Label & Meta */}
                  {isExpanded && (
                    <div className={styles.expandedLabelRow}>
                      <span className={styles.destinationName}>{label}</span>
                      <span className={styles.shortcutTag}>{shortcut}</span>
                    </div>
                  )}
                </button>

                {/* Collapsed Mode: Accessible Floating Tooltip */}
                {!isExpanded && (
                  <div className={styles.tooltip} role="tooltip">
                    <span>{label}</span>
                    <span className={styles.tooltipShortcut}>{shortcut}</span>
                    {badge > 0 && (
                      <span className={styles.tooltipBadge}>
                        {badge} {id === 'incidents' ? 'open' : 'firing'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Expanded Mode Operational Summary Section */}
        {isExpanded && (
          <div className={styles.operationalSection}>
            <span className={styles.operationalHeading}>System Metrics</span>
            <div className={styles.opStatusRow}>
              <span className={styles.opLabel}>Services</span>
              <span className={styles.opValue}>
                <strong className={styles.opUp}>{healthyServicesCount}</strong> / {totalServicesCount}
                {failingServicesCount > 0 && (
                  <strong className={styles.opDown}> ({failingServicesCount} failing)</strong>
                )}
              </span>
            </div>
            <div className={styles.opStatusRow}>
              <span className={styles.opLabel}>Incidents</span>
              <span className={styles.opValue}>
                <strong className={activeIncidentsCount > 0 ? styles.opDown : styles.opUp}>
                  {activeIncidentsCount}
                </strong> active
              </span>
            </div>
            <div className={styles.opStatusRow}>
              <span className={styles.opLabel}>Alert Rules</span>
              <span className={styles.opValue}>
                <strong className={activeAlertsCount > 0 ? styles.opDegraded : styles.opUp}>
                  {activeAlertsCount}
                </strong> firing
              </span>
            </div>
          </div>
        )}

        {/* Bottom Utilities Stack */}
        <div className={styles.bottomSection}>
          <div className={styles.railDivider} role="separator" />

          {/* System Status / Active Incidents Widget (Non-pill) */}
          <div className={styles.statusWidgetWrapper}>
            <button
              type="button"
              className={`${styles.statusWidgetBtn} ${
                isIncident
                  ? styles.statusIncidentBtn
                  : isDegraded
                  ? styles.statusDegradedBtn
                  : styles.statusOperationalBtn
              }`}
              onClick={() => handleSelect(isIncident ? 'incidents' : 'overview')}
              aria-label={
                isIncident
                  ? `${activeIncidentsCount} Active Incident${activeIncidentsCount > 1 ? 's' : ''}`
                  : isDegraded
                  ? 'Degraded Service'
                  : 'All Systems Operational'
              }
            >
              <div
                className={`${styles.statusIconSquircle} ${
                  isIncident
                    ? styles.iconSquircleIncident
                    : isDegraded
                    ? styles.iconSquircleDegraded
                    : styles.iconSquircleOperational
                }`}
              >
                <span
                  className={`${styles.statusPulseDot} ${
                    isIncident
                      ? styles.pulseDotIncident
                      : isDegraded
                      ? styles.pulseDotDegraded
                      : styles.pulseDotOperational
                  }`}
                  aria-hidden="true"
                />
                {isIncident ? (
                  <AlertOctagon size={16} />
                ) : isDegraded ? (
                  <AlertTriangle size={16} />
                ) : (
                  <ShieldCheck size={16} />
                )}
              </div>

              {isExpanded && (
                <div className={styles.statusWidgetText}>
                  <div className={styles.statusWidgetHeader}>
                    <span className={styles.statusWidgetTag}>System Status</span>
                    {isIncident && (
                      <span className={styles.statusBadge}>{activeIncidentsCount}</span>
                    )}
                  </div>
                  <span
                    className={`${styles.statusWidgetTitle} ${
                      isIncident
                        ? styles.titleIncident
                        : isDegraded
                        ? styles.titleDegraded
                        : styles.titleOperational
                    }`}
                  >
                    {isIncident
                      ? `${activeIncidentsCount} Active Incident${activeIncidentsCount > 1 ? 's' : ''}`
                      : isDegraded
                      ? 'Degraded Service'
                      : 'All Systems Operational'}
                  </span>
                </div>
              )}
            </button>

            {/* Collapsed Mode Tooltip */}
            {!isExpanded && (
              <div className={styles.tooltip} role="tooltip">
                <span
                  className={`${styles.tooltipStatusText} ${
                    isIncident
                      ? styles.titleIncident
                      : isDegraded
                      ? styles.titleDegraded
                      : styles.titleOperational
                  }`}
                >
                  {isIncident
                    ? `${activeIncidentsCount} Active Incident${activeIncidentsCount > 1 ? 's' : ''}`
                    : isDegraded
                    ? 'Degraded Service'
                    : 'All Systems Operational'}
                </span>
                <span className={styles.tooltipShortcut}>
                  {isIncident ? 'Incidents' : 'Overview'}
                </span>
              </div>
            )}
          </div>

          {/* Expand / Collapse Control */}
          <div className={styles.navItemWrapper}>
            <button
              className={styles.utilityBtn}
              onClick={() => setIsExpanded((prev) => !prev)}
              title={isExpanded ? 'Collapse Navigation (Rail Mode)' : 'Expand Navigation'}
              aria-label={isExpanded ? 'Collapse Navigation' : 'Expand Navigation'}
            >
              <div className={styles.iconSquircle}>
                {isExpanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
              </div>
              {isExpanded && <span className={styles.utilityLabel}>Collapse Rail</span>}
            </button>
            {!isExpanded && (
              <div className={styles.tooltip} role="tooltip">
                <span>Expand Sidebar</span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
