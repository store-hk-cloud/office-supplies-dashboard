-- ========================================================================
-- Office Supplies Management System — Supabase Schema
-- PostgreSQL Database for Supabase
-- ========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================================
-- USERS TABLE
-- ========================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'requester' CHECK (role IN ('requester','approver','admin','viewer')),
  department VARCHAR(255) DEFAULT 'ไม่ระบุ',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed admin user (password: admin123 via Supabase Auth)
INSERT INTO users (email, name, role, department) VALUES
  ('admin@hillkoff.com', 'ผู้ดูแลระบบ', 'admin', 'ผู้บริหาร'),
  ('somchai@hillkoff.com', 'สมชาย ใจดี', 'requester', 'ฝ่ายไอที'),
  ('manager@hillkoff.com', 'สมหญิง รักดี', 'approver', 'ผู้บริหาร')
ON CONFLICT (email) DO NOTHING;

-- ========================================================================
-- REQUESTS TABLE (คำขอเบิก)
-- ========================================================================
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id VARCHAR(50) UNIQUE NOT NULL,
  requester_email VARCHAR(255) REFERENCES users(email),
  requester_name VARCHAR(255) NOT NULL,
  department VARCHAR(255) DEFAULT 'ไม่ระบุ',
  item VARCHAR(255) NOT NULL,
  category VARCHAR(255) DEFAULT 'ไม่ระบุ',
  quantity NUMERIC(10,2) DEFAULT 0,
  unit_price NUMERIC(10,2) DEFAULT 0,
  total_price NUMERIC(10,2) DEFAULT 0,
  reason TEXT DEFAULT '',
  date_needed DATE,
  request_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  approver_email VARCHAR(255),
  approver_comment TEXT DEFAULT '',
  approval_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_requester ON requests(requester_email);

-- ========================================================================
-- TRANSACTIONS TABLE (รายการที่อนุมัติแล้ว → ใช้กับ Dashboard)
-- ========================================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id VARCHAR(50) UNIQUE NOT NULL,
  request_id VARCHAR(50) REFERENCES requests(request_id),
  date DATE DEFAULT CURRENT_DATE,
  item VARCHAR(255) NOT NULL,
  category VARCHAR(255) DEFAULT 'ไม่ระบุ',
  department VARCHAR(255) DEFAULT 'ไม่ระบุ',
  quantity NUMERIC(10,2) DEFAULT 0,
  unit_price NUMERIC(10,2) DEFAULT 0,
  total_price NUMERIC(10,2) DEFAULT 0,
  requester_name VARCHAR(255),
  approved_by VARCHAR(255),
  approval_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_department ON transactions(department);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

-- ========================================================================
-- BUDGETS TABLE (งบประมาณรายเดือน/แผนก)
-- ========================================================================
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department VARCHAR(255) NOT NULL,
  month VARCHAR(7) NOT NULL, -- YYYY-MM
  budget_limit NUMERIC(12,2) DEFAULT 0,
  current_usage NUMERIC(12,2) DEFAULT 0,
  usage_percent NUMERIC(5,2) DEFAULT 0,
  alert_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department, month)
);

-- ========================================================================
-- INVENTORY TABLE (สินค้าคงคลัง)
-- ========================================================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id VARCHAR(50) UNIQUE NOT NULL,
  item VARCHAR(255) NOT NULL,
  category VARCHAR(255) DEFAULT 'ไม่ระบุ',
  stock_qty NUMERIC(10,2) DEFAULT 0,
  min_stock NUMERIC(10,2) DEFAULT 5,
  unit_price NUMERIC(10,2) DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'ชิ้น',
  supplier VARCHAR(255),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================================
-- SUPPLIERS TABLE
-- ========================================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================================
-- ASSETS TABLE (ทะเบียนทรัพย์สิน)
-- ========================================================================
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(255) DEFAULT 'ไม่ระบุ',
  department VARCHAR(255),
  purchase_date DATE,
  purchase_price NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'ใช้งาน',
  assigned_to VARCHAR(255),
  location VARCHAR(255),
  notes TEXT,
  lifespan_years INT DEFAULT 5,
  current_value NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================================
-- LOGS TABLE (บันทึกกิจกรรม)
-- ========================================================================
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_email VARCHAR(255),
  action VARCHAR(100),
  details TEXT,
  related_id VARCHAR(50)
);

-- ========================================================================
-- IMPORT LOG TABLE (บันทึกการนำเข้าข้อมูล)
-- ========================================================================
CREATE TABLE IF NOT EXISTS import_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name VARCHAR(255),
  total_rows INT DEFAULT 0,
  imported_rows INT DEFAULT 0,
  skipped_rows INT DEFAULT 0,
  errors TEXT,
  month_key VARCHAR(7),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
