-- ========================================================================
-- Office Supplies v5.2 — New Tables for Notifications & Templates
-- Run this in Supabase SQL Editor
-- ========================================================================

-- NOTIFICATION LOGS TABLE
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient VARCHAR(255),
  subject VARCHAR(500),
  message TEXT,
  type VARCHAR(50) DEFAULT 'alert',
  status VARCHAR(50) DEFAULT 'logged',
  external_id VARCHAR(255),
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- REQUEST TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS request_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  department VARCHAR(255) DEFAULT '',
  approver_email VARCHAR(255) DEFAULT '',
  reason TEXT DEFAULT '',
  items JSONB DEFAULT '[]'::jsonb,
  created_by VARCHAR(255) DEFAULT '',
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_dept ON request_templates(department);
CREATE INDEX IF NOT EXISTS idx_notification_type ON notification_logs(type);