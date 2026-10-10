-- Migration 001: Create services table for Service Registry
-- CloudPulse: Portfolio-grade distributed service monitoring and alerting platform

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    base_url VARCHAR(2048) NOT NULL,
    health_check_path VARCHAR(2048) NOT NULL DEFAULT '/health',
    environment VARCHAR(50) NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
    check_interval_seconds INTEGER NOT NULL DEFAULT 30 CHECK (check_interval_seconds > 0),
    timeout_ms INTEGER NOT NULL DEFAULT 5000 CHECK (timeout_ms > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for frequently queried filter and sorting columns
CREATE INDEX IF NOT EXISTS idx_services_environment ON services(environment);
CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);
