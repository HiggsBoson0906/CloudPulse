-- Migration 002: Add health check results, metric aggregates, alert rules, alerts, and incidents schema
-- CloudPulse Phase 1: Complete Backend Implementation

-- 1. Extend services table with is_enabled and duplicate protection
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT true;

-- Unique constraint preventing duplicate service registrations in the same environment
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_services_name_environment'
    ) THEN
        ALTER TABLE services ADD CONSTRAINT uq_services_name_environment UNIQUE (name, environment);
    END IF;
END $$;

-- 2. Health check results (durable time-series log of all pings)
CREATE TABLE IF NOT EXISTS health_check_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    check_timestamp TIMESTAMPTZ NOT NULL,
    status_code INTEGER,
    latency_ms INTEGER NOT NULL,
    is_success BOOLEAN NOT NULL,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_checks_service_time 
    ON health_check_results(service_id, check_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp 
    ON health_check_results(check_timestamp DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_health_checks_service_timestamp'
    ) THEN
        ALTER TABLE health_check_results ADD CONSTRAINT uq_health_checks_service_timestamp UNIQUE (service_id, check_timestamp);
    END IF;
END $$;

-- 3. Metric Aggregates (precomputed rollups for dashboard speed)
CREATE TABLE IF NOT EXISTS metric_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    window_type VARCHAR(20) NOT NULL, -- '15m', '1h', '24h'
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    total_checks INTEGER NOT NULL,
    success_count INTEGER NOT NULL,
    failure_count INTEGER NOT NULL,
    error_rate NUMERIC(5, 2) NOT NULL,
    avg_latency_ms NUMERIC(10, 2) NOT NULL,
    p95_latency_ms NUMERIC(10, 2) NOT NULL,
    p99_latency_ms NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_metric_aggregates_window UNIQUE (service_id, window_type, window_start)
);

CREATE INDEX IF NOT EXISTS idx_metric_aggregates_lookup 
    ON metric_aggregates(service_id, window_type, window_start DESC);

-- 4. Alert Rules
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE CASCADE, -- NULL means global rule for all services
    name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('error_rate', 'p95_latency', 'service_down', 'consecutive_failures')),
    threshold NUMERIC(10, 2) NOT NULL,
    window_minutes INTEGER NOT NULL DEFAULT 5 CHECK (window_minutes > 0),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    cooldown_minutes INTEGER NOT NULL DEFAULT 15 CHECK (cooldown_minutes >= 0),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_service 
    ON alert_rules(service_id, is_enabled);

-- 5. Alerts (individual alert occurrences)
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('firing', 'resolved')),
    message TEXT NOT NULL,
    current_value NUMERIC(10, 2) NOT NULL,
    threshold_value NUMERIC(10, 2) NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_active 
    ON alerts(service_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_rule_status 
    ON alerts(rule_id, status);

-- 6. Incidents
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    summary TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_service_status 
    ON incidents(service_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_opened_at 
    ON incidents(opened_at DESC);

-- 7. Incident-Alert link (Many-to-Many relation)
CREATE TABLE IF NOT EXISTS incident_alerts (
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    PRIMARY KEY (incident_id, alert_id)
);
