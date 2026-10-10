import React, { useState } from 'react';
import {
  LayoutDashboard,
  Server,
  BellRing,
  AlertOctagon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import styles from './Sidebar.module.css';

export type TabId = 'overview' | 'services' | 'alerts' | 'incidents';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  activeIncidentsCount: number;
  activeAlertsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  activeIncidentsCount,
  activeAlertsCount,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  return (
    <aside
      className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ''}`}
      aria-label="Platform navigation"
    >
      <nav className={styles.navGroup}>
        <button
          className={`${styles.navItem} ${activeTab === 'overview' ? styles.navItemActive : ''}`}
          onClick={() => onTabChange('overview')}
          title="Overview Dashboard (Alt+1)"
        >
          <LayoutDashboard size={18} className={styles.navIcon} />
          {!isCollapsed && <span className={styles.navLabel}>Overview</span>}
        </button>

        <button
          className={`${styles.navItem} ${activeTab === 'services' ? styles.navItemActive : ''}`}
          onClick={() => onTabChange('services')}
          title="Service Registry (Alt+2)"
        >
          <Server size={18} className={styles.navIcon} />
          {!isCollapsed && <span className={styles.navLabel}>Services</span>}
        </button>

        <button
          className={`${styles.navItem} ${activeTab === 'alerts' ? styles.navItemActive : ''}`}
          onClick={() => onTabChange('alerts')}
          title="Alert Rules & Firing Alerts (Alt+3)"
        >
          <BellRing size={18} className={styles.navIcon} />
          {!isCollapsed && <span className={styles.navLabel}>Alert Rules</span>}
          {!isCollapsed && activeAlertsCount > 0 && (
            <span className={styles.badge}>{activeAlertsCount}</span>
          )}
        </button>

        <button
          className={`${styles.navItem} ${activeTab === 'incidents' ? styles.navItemActive : ''}`}
          onClick={() => onTabChange('incidents')}
          title="Incident Management (Alt+4)"
        >
          <AlertOctagon size={18} className={styles.navIcon} />
          {!isCollapsed && <span className={styles.navLabel}>Incidents</span>}
          {!isCollapsed && activeIncidentsCount > 0 && (
            <span className={styles.badge}>{activeIncidentsCount}</span>
          )}
        </button>
      </nav>

      <div className={styles.bottomSection}>
        <button
          className={styles.collapseToggle}
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
};
