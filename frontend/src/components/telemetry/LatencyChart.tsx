import React, { useState } from 'react';
import { getCheckError, getCheckLatency, type HealthCheckResult } from '../../types';

interface LatencyChartProps {
  checks: HealthCheckResult[];
  compact?: boolean;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch {
    return '';
  }
}

export const LatencyChart: React.FC<LatencyChartProps> = ({ checks, compact = false }) => {
  const [hoveredCheck, setHoveredCheck] = useState<HealthCheckResult | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  if (checks.length === 0) {
    return (
      <div
        style={{
          minHeight: compact ? '160px' : '220px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--cp-text-muted)',
          fontSize: '13px',
          gap: '8px',
          border: '1px dashed var(--cp-border-subtle)',
          borderRadius: 'var(--cp-radius-md)',
          backgroundColor: 'var(--cp-bg-well)',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <span>No probe telemetry recorded for this service yet.</span>
        <span style={{ fontSize: '11px', color: 'var(--cp-text-muted)', maxWidth: '340px' }}>
          Historical data points will populate automatically as health check probes execute.
        </span>
      </div>
    );
  }

  // Single probe measurement: truthful representation without pretending to be a trend line
  if (checks.length === 1) {
    const single = checks[0];
    const lat = getCheckLatency(single);
    return (
      <div
        style={{
          minHeight: compact ? '160px' : '220px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--cp-text-secondary)',
          fontSize: '13px',
          gap: '8px',
          border: '1px dashed var(--cp-border-subtle)',
          borderRadius: 'var(--cp-radius-md)',
          backgroundColor: 'var(--cp-bg-well)',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: single.isSuccess ? 'var(--cp-status-up)' : 'var(--cp-status-down)',
            }}
          />
          <strong>
            Single probe recorded: {lat !== null ? `${lat}ms` : '—'} (
            {single.isSuccess ? `HTTP ${single.statusCode ?? 200}` : 'Failed'}
            )
          </strong>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--cp-text-muted)', fontFamily: 'var(--cp-font-mono)' }}>
          {new Date(single.checkTimestamp).toLocaleString()}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--cp-text-muted)', maxWidth: '340px' }}>
          Additional probe data points will populate automatically to form a time-series history.
        </span>
      </div>
    );
  }

  // Chronological order: oldest checks on left, most recent on right
  const chronological = [...checks].reverse();
  const latencies = chronological.map((c) => getCheckLatency(c) ?? 0);
  const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
  const maxLatency = Math.max(...latencies, 50); // at least 50ms vertical scale
  const avgLatency =
    latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const successCount = chronological.filter((c) => c.isSuccess).length;
  const successRate = ((successCount / chronological.length) * 100).toFixed(1);
  const yMax = Math.ceil(maxLatency * 1.25); // 25% headroom

  const width = compact ? 520 : 860;
  const height = compact ? 200 : 220;
  const padding = compact
    ? { top: 16, right: 20, bottom: 34, left: 52 }
    : { top: 24, right: 36, bottom: 36, left: 60 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const bottomY = padding.top + graphHeight;

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
  const areaPath = `${linePath} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`;
  const avgY = padding.top + graphHeight - (avgLatency / yMax) * graphHeight;

  // Real timestamp ticks along X-axis
  const xTicks = [
    { x: points[0].x, time: formatTime(chronological[0].checkTimestamp), anchor: 'start' as const },
    {
      x: points[Math.floor((points.length - 1) / 2)].x,
      time: formatTime(chronological[Math.floor((chronological.length - 1) / 2)].checkTimestamp),
      anchor: 'middle' as const,
    },
    {
      x: points[points.length - 1].x,
      time: formatTime(chronological[chronological.length - 1].checkTimestamp),
      anchor: 'end' as const,
    },
  ];

  const yTicks = compact ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
      {/* Telemetry Summary Stats Header Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? '12px' : '20px',
          marginBottom: '12px',
          flexWrap: 'wrap',
          fontSize: compact ? '11px' : '13px',
          fontFamily: 'var(--cp-font-mono)',
          color: 'var(--cp-text-secondary)',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--cp-border-subtle)',
          justifyContent: compact ? 'space-between' : 'flex-start',
        }}
      >
        {!compact && (
          <span style={{ color: 'var(--cp-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '11px', fontWeight: 600 }}>
            Window Telemetry:
          </span>
        )}
        <span>
          Samples: <strong style={{ color: 'var(--cp-text-primary)' }}>{chronological.length}</strong>
        </span>
        <span>
          Min: <strong style={{ color: 'var(--cp-status-up)' }}>{minLatency}ms</strong>
        </span>
        <span>
          Mean: <strong style={{ color: 'var(--cp-text-primary)' }}>{avgLatency}ms</strong>
        </span>
        <span>
          Max:{' '}
          <strong style={{ color: maxLatency > 300 ? 'var(--cp-status-down)' : 'var(--cp-text-primary)' }}>
            {maxLatency}ms
          </strong>
        </span>
        <span>
          Success:{' '}
          <strong
            style={{
              color: Number(successRate) >= 99 ? 'var(--cp-status-up)' : 'var(--cp-status-degraded)',
            }}
          >
            {successRate}%
          </strong>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="Service Response Time Telemetry Graph"
      >
        <defs>
          <linearGradient id="latencyAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cp-text-primary)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--cp-text-primary)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines */}
        {yTicks.map((pct) => {
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
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 8}
                y={yVal + 4}
                textAnchor="end"
                fontSize={compact ? '10' : '11'}
                fill="var(--cp-text-muted)"
                fontFamily="var(--cp-font-mono)"
              >
                {labelVal}ms
              </text>
            </g>
          );
        })}

        {/* Mean Latency Reference Line */}
        <line
          x1={padding.left}
          y1={avgY}
          x2={width - padding.right}
          y2={avgY}
          stroke="var(--cp-border-strong)"
          strokeDasharray="5 3"
          strokeWidth="1.5"
        />

        {/* Area fill */}
        <path d={areaPath} fill="url(#latencyAreaGrad)" />

        {/* Latency line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--cp-text-primary)"
          strokeWidth={compact ? '1.8' : '2'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* X-axis Baseline & Real Check Timestamp Ticks */}
        <line
          x1={padding.left}
          y1={bottomY}
          x2={width - padding.right}
          y2={bottomY}
          stroke="var(--cp-border-strong)"
          strokeWidth="1"
        />
        {xTicks.map((tick, idx) => (
          <g key={idx}>
            <line
              x1={tick.x}
              y1={bottomY}
              x2={tick.x}
              y2={bottomY + 4}
              stroke="var(--cp-border-strong)"
              strokeWidth="1"
            />
            <text
              x={tick.x}
              y={bottomY + 16}
              textAnchor={tick.anchor}
              fontSize={compact ? '10' : '11'}
              fill="var(--cp-text-muted)"
              fontFamily="var(--cp-font-mono)"
            >
              {tick.time}
            </text>
          </g>
        ))}

        {/* Data points */}
        {points.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={p.check === hoveredCheck ? (compact ? 5 : 6) : compact ? 3 : 3.5}
            fill={p.check.isSuccess ? 'var(--cp-status-up)' : 'var(--cp-status-down)'}
            stroke="var(--cp-bg-surface)"
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

      {/* Crosshair Diagnostic Tooltip */}
      {hoveredCheck && hoverPos && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(Math.max(hoverPos.x - 70, 8), compact ? 260 : 680)}px`,
            top: `${Math.max(hoverPos.y - 75, 6)}px`,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong>{getCheckLatency(hoveredCheck) !== null ? `${getCheckLatency(hoveredCheck)}ms` : '—'}</strong>
            <span
              style={{
                color: hoveredCheck.isSuccess ? 'var(--cp-status-up)' : 'var(--cp-status-down)',
                fontWeight: 600,
              }}
            >
              {hoveredCheck.isSuccess ? `HTTP ${hoveredCheck.statusCode ?? 200}` : `FAIL (${hoveredCheck.statusCode ?? 'ERR'})`}
            </span>
          </div>
          <div style={{ color: 'var(--cp-text-muted)', fontSize: '10px', marginTop: 2 }}>
            {new Date(hoveredCheck.checkTimestamp).toLocaleTimeString()}
          </div>
          {!hoveredCheck.isSuccess && getCheckError(hoveredCheck) && (
            <div style={{ color: 'var(--cp-status-down)', fontSize: '10px', marginTop: 2, maxWidth: 220, whiteSpace: 'normal' }}>
              {getCheckError(hoveredCheck)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
