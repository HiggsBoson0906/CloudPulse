import React, { useState } from 'react';
import { getCheckError, getCheckLatency, type HealthCheckResult } from '../../types';

interface LatencyChartProps {
  checks: HealthCheckResult[];
}

export const LatencyChart: React.FC<LatencyChartProps> = ({ checks }) => {
  const [hoveredCheck, setHoveredCheck] = useState<HealthCheckResult | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  if (checks.length === 0) {
    return (
      <div
        style={{
          height: '200px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--cp-text-muted)',
          fontSize: '13px',
          gap: '8px',
          border: '1px dashed var(--cp-border-subtle)',
          borderRadius: 'var(--cp-radius-md)',
        }}
      >
        <span>No probe samples recorded for this timeframe yet.</span>
        <span style={{ fontSize: '11px', color: 'var(--cp-text-muted)' }}>
          Telemetry will appear automatically as health checks execute.
        </span>
      </div>
    );
  }

  // Chronological order: older checks on left, recent checks on right
  const chronological = [...checks].reverse();
  const latencies = chronological.map((c) => getCheckLatency(c) ?? 0);
  const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
  const maxLatency = Math.max(...latencies, 50); // at least 50ms scale
  const avgLatency =
    latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const successCount = chronological.filter((c) => c.isSuccess).length;
  const successRate = ((successCount / chronological.length) * 100).toFixed(1);
  const yMax = Math.ceil(maxLatency * 1.2); // 20% headroom

  const width = 800;
  const height = 190;
  const padding = { top: 20, right: 30, bottom: 30, left: 55 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const points = chronological.map((c, i) => {
    const lat = getCheckLatency(c) ?? 0;
    const x = padding.left + (i / Math.max(chronological.length - 1, 1)) * graphWidth;
    const y = padding.top + graphHeight - (lat / yMax) * graphHeight;
    return { x, y, check: c };
  });

  const linePath = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const bottomY = padding.top + graphHeight;
  const areaPath = `${linePath} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`;

  const avgY = padding.top + graphHeight - (avgLatency / yMax) * graphHeight;

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
      {/* Telemetry Summary Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '12px',
          flexWrap: 'wrap',
          fontSize: '11px',
          fontFamily: 'var(--cp-font-mono)',
          color: 'var(--cp-text-secondary)',
        }}
      >
        <span style={{ color: 'var(--cp-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Window Stats:
        </span>
        <span>Samples: <strong style={{ color: 'var(--cp-text-primary)' }}>{chronological.length}</strong></span>
        <span>Min: <strong style={{ color: 'var(--cp-status-up)' }}>{minLatency}ms</strong></span>
        <span>Avg: <strong style={{ color: '#38BDF8' }}>{avgLatency}ms</strong></span>
        <span>Max: <strong style={{ color: maxLatency > 300 ? 'var(--cp-status-down)' : 'var(--cp-text-primary)' }}>{maxLatency}ms</strong></span>
        <span>Success: <strong style={{ color: Number(successRate) >= 99 ? 'var(--cp-status-up)' : 'var(--cp-status-degraded)' }}>{successRate}%</strong></span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="Response Time Telemetry Chart"
      >
        <defs>
          <linearGradient id="latencyAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.00" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const yVal = padding.top + graphHeight * (1 - pct);
          const labelVal = Math.round(yMax * pct);
          return (
            <g key={pct}>
              <line
                x1={padding.left}
                y1={yVal}
                x2={width - padding.right}
                y2={yVal}
                stroke="var(--cp-border-subtle)"
                strokeDasharray="3 3"
              />
              <text
                x={padding.left - 8}
                y={yVal + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--cp-text-muted)"
                fontFamily="var(--cp-font-mono)"
              >
                {labelVal}ms
              </text>
            </g>
          );
        })}

        {/* Avg Latency Reference Line */}
        <line
          x1={padding.left}
          y1={avgY}
          x2={width - padding.right}
          y2={avgY}
          stroke="rgba(56, 189, 248, 0.4)"
          strokeDasharray="4 2"
          strokeWidth="1"
        />

        {/* Area fill */}
        <path d={areaPath} fill="url(#latencyAreaGrad)" />

        {/* Latency line */}
        <path
          d={linePath}
          fill="none"
          stroke="#38BDF8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={p.check === hoveredCheck ? 5 : 3}
            fill={p.check.isSuccess ? '#10B981' : '#EF4444'}
            stroke="#111827"
            strokeWidth="1.5"
            style={{ cursor: 'pointer', transition: 'r 150ms ease' }}
            onMouseEnter={(e) => {
              setHoveredCheck(p.check);
              const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
              if (rect) {
                setHoverPos({
                  x: (p.x / width) * rect.width,
                  y: (p.y / height) * rect.height,
                });
              }
            }}
            onMouseLeave={() => {
              setHoveredCheck(null);
              setHoverPos(null);
            }}
          />
        ))}
      </svg>

      {/* Crosshair Tooltip */}
      {hoveredCheck && hoverPos && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(Math.max(hoverPos.x - 70, 10), 650)}px`,
            top: `${Math.max(hoverPos.y - 75, 5)}px`,
            backgroundColor: 'var(--cp-bg-surface-elevated)',
            border: '1px solid var(--cp-border-strong)',
            borderRadius: 'var(--cp-radius-sm)',
            padding: '6px 10px',
            fontSize: '11px',
            fontFamily: 'var(--cp-font-mono)',
            color: 'var(--cp-text-primary)',
            pointerEvents: 'none',
            boxShadow: 'var(--cp-shadow-elevated)',
            zIndex: 50,
            whiteSpace: 'nowrap',
          }}
        >
          <div>
            <strong>{getCheckLatency(hoveredCheck) !== null ? `${getCheckLatency(hoveredCheck)}ms` : '—'}</strong> · Status:{' '}
            <span style={{ color: hoveredCheck.isSuccess ? 'var(--cp-status-up)' : 'var(--cp-status-down)' }}>
              {hoveredCheck.statusCode ?? 'ERR'}
            </span>
          </div>
          <div style={{ color: 'var(--cp-text-muted)', fontSize: '10px' }}>
            {new Date(hoveredCheck.checkTimestamp).toLocaleTimeString()}
          </div>
          {!hoveredCheck.isSuccess && getCheckError(hoveredCheck) && (
            <div style={{ color: 'var(--cp-status-down)', fontSize: '10px' }}>
              {getCheckError(hoveredCheck)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
