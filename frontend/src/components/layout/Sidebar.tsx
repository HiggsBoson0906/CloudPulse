import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Server,
  BellRing,
  AlertOctagon,
  BarChart2,
} from 'lucide-react';
import styles from './Sidebar.module.css';

export type TabId = 'overview' | 'services' | 'alerts' | 'incidents';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  activeIncidentsCount: number;
  activeAlertsCount: number;
}

const NAV_ITEMS = [
  { id: 'overview' as TabId, label: 'Overview', Icon: LayoutDashboard, shortcut: 'Alt+1' },
  { id: 'services' as TabId, label: 'Services', Icon: Server, shortcut: 'Alt+2' },
  { id: 'alerts' as TabId, label: 'Alert Rules', Icon: BellRing, shortcut: 'Alt+3' },
  { id: 'incidents' as TabId, label: 'Incidents', Icon: AlertOctagon, shortcut: 'Alt+4' },
] as const;

const MIN_WIDTH = 72;
const MAX_WIDTH = 320;
const DEFAULT_WIDTH = 220;
const COLLAPSED_WIDTH = 72;

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  activeIncidentsCount,
  activeAlertsCount,
}) => {
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem('cp_sidebar_width');
    return saved ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(saved))) : DEFAULT_WIDTH;
  });
  const isCollapsed = width <= COLLAPSED_WIDTH + 10;

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);
  const sidebarRef = useRef<HTMLElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const delta = e.clientX - startX.current;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth.current + delta));
      setWidth(newWidth);
    }
    function handleMouseUp() {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setWidth((w) => {
        localStorage.setItem('cp_sidebar_width', String(w));
        return w;
      });
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const getBadgeCount = (id: TabId) => {
    if (id === 'alerts') return activeAlertsCount;
    if (id === 'incidents') return activeIncidentsCount;
    return 0;
  };

  return (
    <aside
      ref={sidebarRef}
      className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ''}`}
      style={{ width: `${width}px` }}
      aria-label="Platform navigation"
    >
      <nav className={styles.navGroup}>
        {NAV_ITEMS.map(({ id, label, Icon, shortcut }) => {
          const badge = getBadgeCount(id);
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              onClick={() => onTabChange(id)}
              title={`${label} (${shortcut})`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={styles.navIconWrap}>
                <Icon size={20} className={styles.navIcon} />
                {badge > 0 && isCollapsed && (
                  <span className={styles.dotBadge} />
                )}
              </span>
              {!isCollapsed && (
                <>
                  <span className={styles.navLabel}>{label}</span>
                  {badge > 0 && (
                    <span className={styles.badge}>{badge}</span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Resize Handle */}
      <div
        className={styles.resizeHandle}
        onMouseDown={handleMouseDown}
        title="Drag to resize sidebar"
        aria-hidden="true"
      />
    </aside>
  );
};
