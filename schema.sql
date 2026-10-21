-- D1 SQL Schema Initialization for Construction Contracting Accounting
-- Execute this via: wrangler d1 execute hesabdar_peymankar --remote --file=schema.sql

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
  stages TEXT,
  current_stage TEXT,
  status TEXT,
  is_deleted INTEGER DEFAULT 0,
  deleted_at TEXT,
  number_of_units INTEGER,
  default_unit_area REAL,
  default_price_per_meter REAL,
  blocks_json TEXT,
  supervisor_name TEXT,
  building_specs_json TEXT,
  unit_specs_json TEXT,
  extra_json TEXT
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
  nature TEXT,
  project_id TEXT,
  extra_json TEXT
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT,
  role_name TEXT,
  roles_json TEXT,
  national_id TEXT,
  bank_card_number TEXT,
  bank_name TEXT,
  bank_iban TEXT,
  job_category TEXT,
  payment_method TEXT,
  barter_units_json TEXT,
  balance REAL,
  created_at TEXT,
  project_id TEXT,
  extra_json TEXT
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
  invoice_number TEXT,
  description TEXT,
  material_category TEXT,
  attachment_url TEXT,
  status TEXT,
  created_at TEXT,
  contact_id TEXT,
  person_name TEXT,
  stage TEXT,
  payment_status TEXT DEFAULT 'paid',
  attachment_name TEXT,
  attachment_data TEXT,
  payments_json TEXT,
  extra_json TEXT
);

CREATE TABLE IF NOT EXISTS pre_sales (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  contact_id TEXT,
  unit_id TEXT,
  block_name TEXT,
  sale_area_type TEXT,
  useful_area REAL,
  storage_area REAL,
  parking_area REAL,
  common_area REAL,
  contract_area REAL,
  price_per_meter REAL,
  total_price REAL,
  contract_date TEXT,
  status TEXT,
  has_exact_area INTEGER DEFAULT 0,
  exact_area REAL,
  secondary_price_per_meter REAL,
  extra_json TEXT
);

CREATE TABLE IF NOT EXISTS pre_sale_installments (
  id TEXT PRIMARY KEY,
  pre_sale_id TEXT,
  installment_name TEXT,
  due_date TEXT,
  amount REAL,
  is_paid INTEGER,
  paid_date TEXT,
  paid_amount REAL DEFAULT 0
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
  average_price REAL,
  code TEXT,
  sub_category TEXT,
  secondary_unit TEXT,
  conversion_factor REAL,
  consumption_type TEXT,
  min_stock REAL,
  purchase_price REAL,
  project_id TEXT,
  extra_json TEXT
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
  invoice_number TEXT,
  is_non_cash INTEGER DEFAULT 0,
  barter_property_type TEXT,
  barter_description TEXT,
  barter_agreed_value REAL,
  attachment_name TEXT,
  attachment_data TEXT,
  approval_status TEXT DEFAULT 'approved',
  approved_amount REAL,
  approved_by TEXT,
  approved_date TEXT,
  pre_sale_id TEXT,
  contact_id TEXT,
  payment_status TEXT DEFAULT 'paid',
  payments_json TEXT,
  extra_json TEXT
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
  block_name TEXT,
  floor TEXT,
  sale_area_type TEXT,
  useful_area REAL,
  storage_area REAL,
  parking_area REAL,
  common_area REAL,
  area REAL,
  price_per_meter REAL,
  total_price REAL,
  status TEXT,
  buyer_name TEXT,
  contact_id TEXT,
  contract_id TEXT,
  down_payment REAL,
  barter_property TEXT,
  specific_expenses TEXT,
  is_deleted INTEGER DEFAULT 0,
  deleted_at TEXT,
  extra_json TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  role_name TEXT,
  username TEXT,
  password TEXT,
  permissions TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS timesheets (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  contact_id TEXT,
  person_name TEXT,
  date TEXT,
  hours_worked REAL,
  overtime_hours REAL,
  daily_rate REAL,
  overtime_rate REAL,
  total_pay REAL,
  stage TEXT,
  description TEXT,
  is_paid INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payrolls (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  contact_id TEXT,
  person_name TEXT,
  month TEXT,
  year TEXT,
  base_salary REAL,
  housing_allowance REAL,
  food_allowance REAL,
  child_allowance REAL,
  overtime_hours REAL,
  overtime_pay REAL,
  bonuses REAL,
  insurance_worker REAL,
  insurance_employer REAL,
  tax_deduction REAL,
  advance_deduction REAL,
  other_deductions REAL,
  gross_salary REAL,
  net_payable REAL,
  payment_date TEXT,
  account_id TEXT,
  is_paid INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  version_name TEXT,
  shamsi_date TEXT,
  shamsi_time TEXT,
  created_at INTEGER,
  source TEXT,
  stats_json TEXT,
  db_json TEXT
);
