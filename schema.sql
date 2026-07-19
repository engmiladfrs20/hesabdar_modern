-- D1 SQL Schema Initialization for Construction Contracting Accounting
-- Execute this via: wrangler d1 execute construction-accounting-db --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  name TEXT NOT NULL,
  address TEXT,
  total_area REAL,
  budget REAL,
  stages TEXT, -- Store JSON string of stages
  current_stage TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  type_name TEXT,
  account_number TEXT,
  bank_name TEXT,
  balance REAL,
  code TEXT,
  level INTEGER,
  parent_code TEXT,
  nature TEXT
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT,
  national_id TEXT,
  bank_card_number TEXT,
  balance REAL,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS imprest_funds (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  contact_id TEXT,
  allocated_limit REAL,
  balance REAL,
  status TEXT,
  last_reconciliation_date TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS imprest_expenses (
  id TEXT PRIMARY KEY,
  imprest_id TEXT,
  expense_date TEXT,
  amount REAL,
  description TEXT,
  material_category TEXT,
  attachment_url TEXT,
  status TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS pre_sales (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  contact_id TEXT,
  unit_id TEXT,
  contract_area REAL,
  price_per_meter REAL,
  total_price REAL,
  contract_date TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS pre_sale_installments (
  id TEXT PRIMARY KEY,
  pre_sale_id TEXT,
  installment_name TEXT,
  due_date TEXT,
  amount REAL,
  is_paid INTEGER,
  paid_date TEXT
);

CREATE TABLE IF NOT EXISTS alerts_log (
  id TEXT PRIMARY KEY,
  type TEXT,
  reference_id TEXT,
  recipient_phone TEXT,
  message TEXT,
  send_date TEXT,
  is_sent INTEGER
);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT,
  stock REAL,
  average_price REAL
);

CREATE TABLE IF NOT EXISTS material_transactions (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  material_id TEXT,
  type TEXT,
  quantity REAL,
  unit_price REAL,
  date TEXT,
  person_name TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  project_id TEXT,
  type TEXT,
  category TEXT,
  sub_category TEXT,
  amount REAL,
  account_id TEXT,
  person_name TEXT,
  date TEXT,
  description TEXT,
  is_non_cash INTEGER DEFAULT 0,
  barter_property_type TEXT,
  barter_description TEXT,
  barter_agreed_value REAL,
  attachment_name TEXT,
  attachment_data TEXT -- Store base64 data for electronic archiving
);

CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  project_id TEXT,
  check_number TEXT,
  bank_name TEXT,
  due_date TEXT,
  amount REAL,
  type TEXT,
  status TEXT,
  person_name TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  unit_number TEXT,
  floor TEXT,
  area REAL,
  price_per_meter REAL,
  total_price REAL,
  status TEXT,
  buyer_name TEXT,
  down_payment REAL,
  barter_property TEXT
);
