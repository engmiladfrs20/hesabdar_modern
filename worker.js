// Cloudflare Worker Script (worker.js)
// Complete Serverless REST API for Farsi Construction Accounting Suite, integrated with Cloudflare D1.

// Helper functions for casing conversions
function keysToCamel(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(keysToCamel);
  if (typeof obj !== "object") return obj;

  const n = {};
  for (const k of Object.keys(obj)) {
    const camel = k.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    n[camel] = keysToCamel(obj[k]);
  }
  return n;
}

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function getTodayShamsiWorker() {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const y = parts.find(p => p.type === "year")?.value || "1404";
    const m = parts.find(p => p.type === "month")?.value || "01";
    const d = parts.find(p => p.type === "day")?.value || "01";
    return `${y}/${m.padStart(2, "0")}/${d.padStart(2, "0")}`;
  } catch {
    return "1404/01/01";
  }
}

function getShamsiDateTimeWorker() {
  const shamsiDate = getTodayShamsiWorker();
  let shamsiTime = "00:00:00";
  try {
    const now = new Date();
    const tParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tehran",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(now);
    const hh = tParts.find(p => p.type === "hour")?.value || String(now.getHours()).padStart(2, "0");
    const mm = tParts.find(p => p.type === "minute")?.value || String(now.getMinutes()).padStart(2, "0");
    const ss = tParts.find(p => p.type === "second")?.value || String(now.getSeconds()).padStart(2, "0");
    shamsiTime = `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:${ss.padStart(2, "0")}`;
  } catch {
    const now = new Date();
    shamsiTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  }
  return {
    shamsiDate,
    shamsiTime,
    versionName: `نسخه ${shamsiDate} - ساعت ${shamsiTime}`
  };
}

async function createCloudBackupSnapshot(env, dbData, sourceLabel = "همگام‌سازی خودکار") {
  if (!env || !env.DB || !dbData) return null;
  try {
    const { shamsiDate, shamsiTime, versionName } = getShamsiDateTimeWorker();
    const id = "ver_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const createdAt = Date.now();
    const stats = {
      companies: Array.isArray(dbData.companies) ? dbData.companies.length : 0,
      projects: Array.isArray(dbData.projects) ? dbData.projects.filter(p => !p.isDeleted).length : 0,
      transactions: Array.isArray(dbData.transactions) ? dbData.transactions.length : 0,
      accounts: Array.isArray(dbData.accounts) ? dbData.accounts.length : 0,
      units: Array.isArray(dbData.units) ? dbData.units.filter(u => !u.isDeleted).length : 0,
      contacts: Array.isArray(dbData.contacts) ? dbData.contacts.length : 0,
      preSales: Array.isArray(dbData.preSales) ? dbData.preSales.length : 0,
      checks: Array.isArray(dbData.checks) ? dbData.checks.length : 0
    };
    const cleanDb = { ...dbData };
    delete cleanDb._backupSource;
    delete cleanDb._skipBackupSnapshot;

    await env.DB.prepare(`
      INSERT INTO backups (id, version_name, shamsi_date, shamsi_time, created_at, source, stats_json, db_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      versionName,
      shamsiDate,
      shamsiTime,
      createdAt,
      sourceLabel,
      JSON.stringify(stats),
      JSON.stringify(cleanDb)
    ).run();

    // Keep latest 30 backups in D1
    await env.DB.prepare(`
      DELETE FROM backups WHERE id NOT IN (
        SELECT id FROM backups ORDER BY created_at DESC LIMIT 30
      )
    `).run().catch(() => {});

    return {
      id,
      versionName,
      shamsiDate,
      shamsiTime,
      createdAt,
      source: sourceLabel,
      stats
    };
  } catch (e) {
    console.error("Failed to create cloud backup snapshot:", e);
    return null;
  }
}

function addShamsiMonthsWorker(shamsiDate, monthsToAdd) {
  const parts = (shamsiDate || getTodayShamsiWorker()).split("/").map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return getTodayShamsiWorker();
  }
  let [y, m, d] = parts;
  m += monthsToAdd;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  if (m > 6 && d > 30) d = 30;
  if (m === 12 && d > 29) d = 29;
  return `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
}

// Backblaze B2 Upload Helper
async function uploadBase64ToB2(base64DataUrl, fileName, env, headers) {
  const keyId = headers.get("x-b2-key-id") || env.B2_APPLICATION_KEY_ID;
  const key = headers.get("x-b2-app-key") || env.B2_APPLICATION_KEY;
  const bucketId = headers.get("x-b2-bucket-id") || env.B2_BUCKET_ID;
  const bucketName = headers.get("x-b2-bucket-name") || env.B2_BUCKET_NAME;

  if (!keyId || !key || !bucketId || !bucketName) {
    return null;
  }

  try {
    const matches = base64DataUrl.match(/^data:([^;]+);base64,(.*)$/);
    let contentType = "application/octet-stream";
    let base64Body = base64DataUrl;
    
    if (matches) {
      contentType = matches[1];
      base64Body = matches[2];
    }

    // Decode base64 to binary ArrayBuffer
    const binaryString = atob(base64Body);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // 1. Authorize B2 Account
    const authHeader = "Basic " + btoa(keyId + ":" + key);
    const authRes = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      headers: { "Authorization": authHeader }
    });
    
    if (!authRes.ok) {
      const errorText = await authRes.text();
      throw new Error("بک‌بلیز احراز هویت نشد: " + errorText);
    }
    
    const authData = await authRes.json();
    const { authorizationToken, apiUrl, downloadUrl } = authData;

    // 2. Get Upload URL
    const uploadUrlRes = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: "POST",
      headers: {
        "Authorization": authorizationToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ bucketId })
    });
    
    if (!uploadUrlRes.ok) {
      const errorText = await uploadUrlRes.text();
      throw new Error("خطا در دریافت لینک آپلود B2: " + errorText);
    }
    
    const uploadUrlData = await uploadUrlRes.json();
    const { uploadUrl, authorizationToken: uploadAuthToken } = uploadUrlData;

    // Generate unique filename to avoid duplicates
    const fileExt = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".")) : ".jpg";
    const cleanName = fileName.replace(/[^a-zA-Z0-9]/g, "_");
    const uniqueFileName = `scans/${Date.now()}_${cleanName}${fileExt}`;

    // 3. Upload File to B2
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": uploadAuthToken,
        "X-Bz-File-Name": encodeURIComponent(uniqueFileName),
        "Content-Type": contentType,
        "Content-Length": bytes.length.toString(),
        "X-Bz-Content-Sha1": "do_not_verify"
      },
      body: bytes
    });
    
    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      throw new Error("خطا در آپلود فایل در B2: " + errorText);
    }

    return `${downloadUrl}/file/${bucketName}/${uniqueFileName}`;
  } catch (err) {
    console.error("Backblaze B2 Error:", err);
    throw err;
  }
}

async function ensureDatabaseSchema(env) {
  if (!env || !env.DB) return;
  const schemaQueries = [
    `CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT)`,
    `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, company_id TEXT, name TEXT NOT NULL, address TEXT, total_area REAL, budget REAL, stages TEXT, current_stage TEXT, status TEXT)`,
    `CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT, type_name TEXT, account_number TEXT, bank_name TEXT, balance REAL, code TEXT, level INTEGER, parent_code TEXT, nature TEXT)`,
    `CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, role TEXT, national_id TEXT, bank_card_number TEXT, balance REAL, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS imprest_funds (id TEXT PRIMARY KEY, project_id TEXT, contact_id TEXT, allocated_limit REAL, balance REAL, status TEXT, last_reconciliation_date TEXT, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS imprest_expenses (id TEXT PRIMARY KEY, imprest_id TEXT, expense_date TEXT, amount REAL, description TEXT, material_category TEXT, attachment_url TEXT, status TEXT, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS pre_sales (id TEXT PRIMARY KEY, project_id TEXT, contact_id TEXT, unit_id TEXT, contract_area REAL, price_per_meter REAL, total_price REAL, contract_date TEXT, status TEXT)`,
    `CREATE TABLE IF NOT EXISTS pre_sale_installments (id TEXT PRIMARY KEY, pre_sale_id TEXT, installment_name TEXT, due_date TEXT, amount REAL, is_paid INTEGER, paid_date TEXT)`,
    `CREATE TABLE IF NOT EXISTS alerts_log (id TEXT PRIMARY KEY, type TEXT, reference_id TEXT, recipient_phone TEXT, message TEXT, send_date TEXT, is_sent INTEGER)`,
    `CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT, unit TEXT, stock REAL, average_price REAL)`,
    `CREATE TABLE IF NOT EXISTS material_transactions (id TEXT PRIMARY KEY, project_id TEXT, material_id TEXT, type TEXT, quantity REAL, unit_price REAL, date TEXT, person_name TEXT, description TEXT)`,
    `CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, company_id TEXT, project_id TEXT, type TEXT, category TEXT, sub_category TEXT, amount REAL, account_id TEXT, person_name TEXT, date TEXT, description TEXT, is_non_cash INTEGER DEFAULT 0, barter_property_type TEXT, barter_description TEXT, barter_agreed_value REAL, attachment_name TEXT, attachment_data TEXT)`,
    `CREATE TABLE IF NOT EXISTS checks (id TEXT PRIMARY KEY, company_id TEXT, project_id TEXT, check_number TEXT, bank_name TEXT, due_date TEXT, amount REAL, type TEXT, status TEXT, person_name TEXT, description TEXT)`,
    `CREATE TABLE IF NOT EXISTS units (id TEXT PRIMARY KEY, project_id TEXT, unit_number TEXT, floor TEXT, area REAL, price_per_meter REAL, total_price REAL, status TEXT, buyer_name TEXT, down_payment REAL, barter_property TEXT, specific_expenses TEXT)`,
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT, role_name TEXT, username TEXT, password TEXT, permissions TEXT)`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
    `CREATE TABLE IF NOT EXISTS timesheets (id TEXT PRIMARY KEY, project_id TEXT, contact_id TEXT, person_name TEXT, date TEXT, hours_worked REAL, overtime_hours REAL, daily_rate REAL, overtime_rate REAL, total_pay REAL, stage TEXT, description TEXT, is_paid INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS payrolls (id TEXT PRIMARY KEY, project_id TEXT, contact_id TEXT, person_name TEXT, month TEXT, year TEXT, base_salary REAL, housing_allowance REAL, food_allowance REAL, child_allowance REAL, overtime_hours REAL, overtime_pay REAL, bonuses REAL, insurance_worker REAL, insurance_employer REAL, tax_deduction REAL, advance_deduction REAL, other_deductions REAL, gross_salary REAL, net_payable REAL, payment_date TEXT, account_id TEXT, is_paid INTEGER DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS backups (id TEXT PRIMARY KEY, version_name TEXT, shamsi_date TEXT, shamsi_time TEXT, created_at INTEGER, source TEXT, stats_json TEXT, db_json TEXT)`
  ];

  for (const q of schemaQueries) {
    try {
      await env.DB.prepare(q).run();
    } catch (e) {
      console.error("Schema creation failed for query:", q, e);
    }
  }

  // Ensure accounts table has new columns
  const alterStatements = [
    "ALTER TABLE accounts ADD COLUMN code TEXT",
    "ALTER TABLE accounts ADD COLUMN level INTEGER",
    "ALTER TABLE accounts ADD COLUMN parent_code TEXT",
    "ALTER TABLE accounts ADD COLUMN nature TEXT",
    "ALTER TABLE accounts ADD COLUMN project_id TEXT",
    "ALTER TABLE accounts ADD COLUMN extra_json TEXT",
    "ALTER TABLE projects ADD COLUMN is_deleted INTEGER DEFAULT 0",
    "ALTER TABLE projects ADD COLUMN deleted_at TEXT",
    "ALTER TABLE projects ADD COLUMN number_of_units INTEGER",
    "ALTER TABLE projects ADD COLUMN default_unit_area REAL",
    "ALTER TABLE projects ADD COLUMN default_price_per_meter REAL",
    "ALTER TABLE projects ADD COLUMN blocks_json TEXT",
    "ALTER TABLE projects ADD COLUMN supervisor_name TEXT",
    "ALTER TABLE projects ADD COLUMN building_specs_json TEXT",
    "ALTER TABLE projects ADD COLUMN unit_specs_json TEXT",
    "ALTER TABLE projects ADD COLUMN extra_json TEXT",
    "ALTER TABLE units ADD COLUMN is_deleted INTEGER DEFAULT 0",
    "ALTER TABLE units ADD COLUMN deleted_at TEXT",
    "ALTER TABLE units ADD COLUMN block_name TEXT",
    "ALTER TABLE units ADD COLUMN sale_area_type TEXT",
    "ALTER TABLE units ADD COLUMN useful_area REAL",
    "ALTER TABLE units ADD COLUMN storage_area REAL",
    "ALTER TABLE units ADD COLUMN parking_area REAL",
    "ALTER TABLE units ADD COLUMN common_area REAL",
    "ALTER TABLE units ADD COLUMN contact_id TEXT",
    "ALTER TABLE units ADD COLUMN contract_id TEXT",
    "ALTER TABLE units ADD COLUMN extra_json TEXT",
    "ALTER TABLE contacts ADD COLUMN role_name TEXT",
    "ALTER TABLE contacts ADD COLUMN roles_json TEXT",
    "ALTER TABLE contacts ADD COLUMN bank_name TEXT",
    "ALTER TABLE contacts ADD COLUMN bank_iban TEXT",
    "ALTER TABLE contacts ADD COLUMN job_category TEXT",
    "ALTER TABLE contacts ADD COLUMN payment_method TEXT",
    "ALTER TABLE contacts ADD COLUMN barter_units_json TEXT",
    "ALTER TABLE contacts ADD COLUMN project_id TEXT",
    "ALTER TABLE contacts ADD COLUMN extra_json TEXT",
    "ALTER TABLE users ADD COLUMN permissions TEXT",
    "ALTER TABLE transactions ADD COLUMN invoice_number TEXT",
    "ALTER TABLE transactions ADD COLUMN approval_status TEXT DEFAULT 'approved'",
    "ALTER TABLE transactions ADD COLUMN approved_amount REAL",
    "ALTER TABLE transactions ADD COLUMN approved_by TEXT",
    "ALTER TABLE transactions ADD COLUMN approved_date TEXT",
    "ALTER TABLE transactions ADD COLUMN pre_sale_id TEXT",
    "ALTER TABLE transactions ADD COLUMN contact_id TEXT",
    "ALTER TABLE transactions ADD COLUMN payment_status TEXT DEFAULT 'paid'",
    "ALTER TABLE transactions ADD COLUMN payments_json TEXT",
    "ALTER TABLE transactions ADD COLUMN extra_json TEXT",
    "ALTER TABLE imprest_expenses ADD COLUMN invoice_number TEXT",
    "ALTER TABLE imprest_expenses ADD COLUMN contact_id TEXT",
    "ALTER TABLE imprest_expenses ADD COLUMN person_name TEXT",
    "ALTER TABLE imprest_expenses ADD COLUMN stage TEXT",
    "ALTER TABLE imprest_expenses ADD COLUMN payment_status TEXT DEFAULT 'paid'",
    "ALTER TABLE imprest_expenses ADD COLUMN attachment_name TEXT",
    "ALTER TABLE imprest_expenses ADD COLUMN attachment_data TEXT",
    "ALTER TABLE imprest_expenses ADD COLUMN payments_json TEXT",
    "ALTER TABLE imprest_expenses ADD COLUMN extra_json TEXT",
    "ALTER TABLE pre_sales ADD COLUMN block_name TEXT",
    "ALTER TABLE pre_sales ADD COLUMN sale_area_type TEXT",
    "ALTER TABLE pre_sales ADD COLUMN useful_area REAL",
    "ALTER TABLE pre_sales ADD COLUMN storage_area REAL",
    "ALTER TABLE pre_sales ADD COLUMN parking_area REAL",
    "ALTER TABLE pre_sales ADD COLUMN common_area REAL",
    "ALTER TABLE pre_sales ADD COLUMN has_exact_area INTEGER DEFAULT 0",
    "ALTER TABLE pre_sales ADD COLUMN exact_area REAL",
    "ALTER TABLE pre_sales ADD COLUMN secondary_price_per_meter REAL",
    "ALTER TABLE pre_sales ADD COLUMN extra_json TEXT",
    "ALTER TABLE pre_sale_installments ADD COLUMN paid_amount REAL DEFAULT 0",
    "ALTER TABLE materials ADD COLUMN code TEXT",
    "ALTER TABLE materials ADD COLUMN sub_category TEXT",
    "ALTER TABLE materials ADD COLUMN secondary_unit TEXT",
    "ALTER TABLE materials ADD COLUMN conversion_factor REAL",
    "ALTER TABLE materials ADD COLUMN consumption_type TEXT",
    "ALTER TABLE materials ADD COLUMN min_stock REAL",
    "ALTER TABLE materials ADD COLUMN purchase_price REAL",
    "ALTER TABLE materials ADD COLUMN project_id TEXT",
    "ALTER TABLE materials ADD COLUMN extra_json TEXT"
  ];
  for (const stmt of alterStatements) {
    try { await env.DB.prepare(stmt).run(); } catch (e) {}
  }

  // Ensure default admin user exists if users table is empty (NO fake demo data is seeded)
  try {
    const checkUsers = await env.DB.prepare("SELECT COUNT(*) as count FROM users").first();
    if (!checkUsers || checkUsers.count === 0) {
      await env.DB.prepare("INSERT INTO users (id, name, role, role_name, username, password) VALUES ('u1', 'مهندس میلاد فرخی', 'manager', 'مدیر ارشد پروژه', 'admin', 'Miladlar224')").run().catch(() => {});
    }
  } catch (err) {
    console.error("Default user check failed:", err);
  }
}

async function getFirstAccountId(env, fallback = "a1") {
  try {
    const row = await env.DB.prepare("SELECT id FROM accounts LIMIT 1").first();
    return row && row.id ? row.id : fallback;
  } catch {
    return fallback;
  }
}

function mergeExtraJson(camelObj, rawRow) {
  if (rawRow && rawRow.extra_json) {
    try {
      const extra = JSON.parse(rawRow.extra_json);
      Object.assign(camelObj, extra, camelObj);
    } catch {}
  }
  delete camelObj.extraJson;
  return camelObj;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Backup-Token, x-b2-key-id, x-b2-app-key, x-b2-bucket-id, x-b2-bucket-name",
      "Content-Type": "application/json"
    };

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Serve static assets from Wrangler directory using the ASSETS binding
    // Any requests that do not match '/api/' are treated as static assets or fallback to index.html
    if (!path.startsWith("/api/")) {
      if (env.ASSETS) {
        try {
          const hasExtension = path.includes(".");
          const assetRequest = hasExtension 
            ? request 
            : new Request(url.origin + "/index.html", request);
          
          const assetResponse = await env.ASSETS.fetch(assetRequest);
          if (assetResponse.status < 400) {
            return assetResponse;
          }
        } catch (err) {
          // Fall through to regular worker logic or error
        }
      }
    }

    try {
      // 1. Database Full Export SQL Endpoint (Secure Windows Backup Service)
      if (path === "/api/backup" && method === "GET") {
        const token = url.searchParams.get("token") || request.headers.get("X-Backup-Token");
        if (!token || token !== env.BACKUP_SECRET_TOKEN) {
          return new Response(JSON.stringify({ error: "Access Denied: Invalid backup token" }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const tables = ["companies", "projects", "accounts", "materials", "material_transactions", "transactions", "checks", "units"];
        let exportDump = `-- Cloudflare D1 Construction Accounting SQL Backup\n-- Date: ${new Date().toISOString()}\n\n`;

        for (const table of tables) {
          const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
          exportDump += `-- Dump of table ${table}\n`;
          for (const row of results) {
            const keys = Object.keys(row);
            const vals = keys.map(k => {
              const val = row[k];
              if (val === null) return "NULL";
              if (typeof val === "string") return "'" + val.replace(/'/g, "''") + "'";
              return val;
            });
            exportDump += `INSERT OR REPLACE INTO ${table} (${keys.join(", ")}) VALUES (${vals.join(", ")});\n`;
          }
          exportDump += "\n";
        }

        return new Response(exportDump, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/sql",
            "Content-Disposition": "attachment; filename=d1_construction_backup.sql"
          }
        });
      }

      // 1.5 Test Connection to Backblaze B2
      if (path === "/api/b2/test" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        const keyId = request.headers.get("x-b2-key-id") || body.keyId || env.B2_APPLICATION_KEY_ID;
        const key = request.headers.get("x-b2-app-key") || body.appKey || env.B2_APPLICATION_KEY;
        const bucketId = request.headers.get("x-b2-bucket-id") || body.bucketId || env.B2_BUCKET_ID;
        const bucketName = request.headers.get("x-b2-bucket-name") || body.bucketName || env.B2_BUCKET_NAME;

        if (!keyId || !key || !bucketId || !bucketName) {
          return new Response(JSON.stringify({ 
            status: "error", 
            message: "پیکربندی ناقص است. لطفاً شناسه کلید، کلید برنامه، شناسه باکت و نام باکت را وارد نمایید." 
          }), { status: 400, headers: corsHeaders });
        }

        try {
          // Attempt authorization
          const authHeader = "Basic " + btoa(keyId + ":" + key);
          const authRes = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
            headers: { "Authorization": authHeader }
          });
          
          if (!authRes.ok) {
            const errorText = await authRes.text();
            throw new Error("کلیدهای وارد شده نامعتبر هستند یا دسترسی ندارند: " + errorText);
          }
          
          const authData = await authRes.json();
          const { authorizationToken, apiUrl, downloadUrl } = authData;

          // Attempt getting upload url
          const uploadUrlRes = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
            method: "POST",
            headers: {
              "Authorization": authorizationToken,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ bucketId })
          });
          
          if (!uploadUrlRes.ok) {
            const errorText = await uploadUrlRes.text();
            throw new Error("شناسه باکت (Bucket ID) نامعتبر است: " + errorText);
          }
          
          const uploadUrlData = await uploadUrlRes.json();
          const { uploadUrl, authorizationToken: uploadAuthToken } = uploadUrlData;

          // Perform a small test upload
          const testContent = new TextEncoder().encode("NovinSakht B2 Connection Test - SUCCESS");
          const testRes = await fetch(uploadUrl, {
            method: "POST",
            headers: {
              "Authorization": uploadAuthToken,
              "X-Bz-File-Name": encodeURIComponent("tests/connection_test.txt"),
              "Content-Type": "text/plain",
              "Content-Length": testContent.length.toString(),
              "X-Bz-Content-Sha1": "do_not_verify"
            },
            body: testContent
          });

          if (!testRes.ok) {
            const errorText = await testRes.text();
            throw new Error("آپلود تستی با شکست مواجه شد: " + errorText);
          }

          const fileUrl = `${downloadUrl}/file/${bucketName}/tests/connection_test.txt`;

          return new Response(JSON.stringify({ 
            status: "success", 
            message: "اتصال به مخزن ابری Backblaze B2 با موفقیت برقرار و فایل آزمایشی آپلود شد!",
            downloadUrl: fileUrl
          }), { headers: corsHeaders });
        } catch (err) {
          return new Response(JSON.stringify({ 
            status: "error", 
            message: "خطا در آزمایش اتصال B2: " + err.message 
          }), { status: 500, headers: corsHeaders });
        }
      }

      // 2. Fetch entire database state (unified JSON representation matching db.json)
      if (path === "/api/db" && method === "GET") {
        await ensureDatabaseSchema(env);
        const companiesQ = await env.DB.prepare("SELECT * FROM companies").all();
        const projectsQ = await env.DB.prepare("SELECT * FROM projects").all();
        const accountsQ = await env.DB.prepare("SELECT * FROM accounts").all();
        const materialsQ = await env.DB.prepare("SELECT * FROM materials").all();
        const materialTxsQ = await env.DB.prepare("SELECT * FROM material_transactions").all();
        const transactionsQ = await env.DB.prepare("SELECT * FROM transactions").all();
        const checksQ = await env.DB.prepare("SELECT * FROM checks").all();
        const unitsQ = await env.DB.prepare("SELECT * FROM units").all();
        const contactsQ = await env.DB.prepare("SELECT * FROM contacts").all();
        const imprestFundsQ = await env.DB.prepare("SELECT * FROM imprest_funds").all();
        const imprestExpensesQ = await env.DB.prepare("SELECT * FROM imprest_expenses").all();
        const preSalesQ = await env.DB.prepare("SELECT * FROM pre_sales").all();
        const preSaleInstallmentsQ = await env.DB.prepare("SELECT * FROM pre_sale_installments").all();
        const alertsLogQ = await env.DB.prepare("SELECT * FROM alerts_log").all();
        const usersQ = await env.DB.prepare("SELECT * FROM users").all();
        const timesheetsQ = await env.DB.prepare("SELECT * FROM timesheets").all().catch(() => ({ results: [] }));
        const payrollsQ = await env.DB.prepare("SELECT * FROM payrolls").all().catch(() => ({ results: [] }));

        // Dynamic Users list mapped back to frontend expectations
        const users = (usersQ.results || []).map(u => ({
          id: u.id,
          name: u.name,
          role: u.role,
          roleName: u.role_name || u.roleName,
          username: u.username,
          password: u.password,
          permissions: u.permissions ? JSON.parse(u.permissions) : []
        }));

        // Structure results with camelCase mapping
        const result = {
          companies: keysToCamel(companiesQ.results || []),
          projects: (projectsQ.results || []).map(p => {
            const camel = mergeExtraJson(keysToCamel(p), p);
            camel.isDeleted = p.is_deleted === 1;
            camel.stages = p.stages ? JSON.parse(p.stages) : ["خاک‌برداری", "اسکلت", "سفت‌کاری", "تأسیسات", "نازک‌کاری", "نما", "پایان کار"];
            if (p.blocks_json) { try { camel.blocks = JSON.parse(p.blocks_json); } catch {} delete camel.blocksJson; }
            if (p.building_specs_json) { try { camel.buildingSpecs = JSON.parse(p.building_specs_json); } catch {} delete camel.buildingSpecsJson; }
            if (p.unit_specs_json) { try { camel.unitSpecs = JSON.parse(p.unit_specs_json); } catch {} delete camel.unitSpecsJson; }
            return camel;
          }),
          users: users,
          accounts: (accountsQ.results || []).map(a => mergeExtraJson(keysToCamel(a), a)),
          materials: (materialsQ.results || []).map(m => mergeExtraJson(keysToCamel(m), m)),
          materialTransactions: keysToCamel(materialTxsQ.results || []),
          transactions: (transactionsQ.results || []).map(t => {
            const camel = mergeExtraJson(keysToCamel(t), t);
            camel.isNonCash = t.is_non_cash === 1;
            if (t.payments_json) {
              try { camel.payments = JSON.parse(t.payments_json); } catch { camel.payments = []; }
              delete camel.paymentsJson;
            }
            if (t.barter_property_type) {
              camel.barterDetails = {
                propertyType: t.barter_property_type,
                description: t.barter_description || "",
                agreedValue: t.barter_agreed_value || 0
              };
            }
            return camel;
          }),
          checks: (checksQ.results || []).map(c => keysToCamel(c)),
          units: (unitsQ.results || []).map(u => {
            const camel = mergeExtraJson(keysToCamel(u), u);
            camel.isDeleted = u.is_deleted === 1;
            camel.specificExpenses = u.specific_expenses ? JSON.parse(u.specific_expenses) : [];
            return camel;
          }),
          contacts: (contactsQ.results || []).map(c => {
            const camel = mergeExtraJson(keysToCamel(c), c);
            if (c.roles_json) { try { camel.roles = JSON.parse(c.roles_json); } catch {} delete camel.rolesJson; }
            if (c.barter_units_json) { try { camel.barterUnits = JSON.parse(c.barter_units_json); } catch {} delete camel.barterUnitsJson; }
            return camel;
          }),
          imprestFunds: keysToCamel(imprestFundsQ.results || []),
          imprestExpenses: (imprestExpensesQ.results || []).map(ie => {
            const camel = mergeExtraJson(keysToCamel(ie), ie);
            if (ie.payments_json) { try { camel.payments = JSON.parse(ie.payments_json); } catch {} delete camel.paymentsJson; }
            return camel;
          }),
          preSales: (preSalesQ.results || []).map(ps => {
            const camel = mergeExtraJson(keysToCamel(ps), ps);
            camel.hasExactArea = ps.has_exact_area === 1;
            return camel;
          }),
          preSaleInstallments: (preSaleInstallmentsQ.results || []).map(i => {
            const camel = keysToCamel(i);
            camel.isPaid = i.is_paid === 1;
            return camel;
          }),
          alertsLog: (alertsLogQ.results || []).map(a => {
            const camel = keysToCamel(a);
            camel.isSent = a.is_sent === 1;
            return camel;
          }),
          timesheets: (timesheetsQ.results || []).map(ts => {
            const camel = keysToCamel(ts);
            camel.isPaid = ts.is_paid === 1;
            return camel;
          }),
          payrolls: (payrollsQ.results || []).map(pr => {
            const camel = keysToCamel(pr);
            camel.isPaid = pr.is_paid === 1;
            return camel;
          })
        };

        return new Response(JSON.stringify(result), { headers: corsHeaders });
      }

      // 2b. Database Import/Synchronize from Offline/Electron JSON (Overwrite with Offline Priority)
      if (path === "/api/db/import" && method === "POST") {
        await ensureDatabaseSchema(env);
        const incomingDb = await request.json();
        
        if (!incomingDb || typeof incomingDb !== "object") {
          return new Response(JSON.stringify({ error: "فرمت داده‌های ارسالی نامعتبر است" }), { status: 400, headers: corsHeaders });
        }

        const requiredKeys = ["companies", "projects", "accounts", "materials", "transactions", "checks", "units", "contacts"];
        const missingKeys = requiredKeys.filter(key => !Array.isArray(incomingDb[key]));

        if (missingKeys.length > 0) {
          return new Response(JSON.stringify({ 
            error: `آرایه‌های مربوط به داده‌های زیر یافت نشد یا معتبر نیست: ${missingKeys.join(", ")}` 
          }), { status: 400, headers: corsHeaders });
        }

        const batchQueries = [];

        // 1. Delete all existing records
        const tables = ["companies", "projects", "accounts", "materials", "material_transactions", "transactions", "checks", "units", "contacts", "imprest_funds", "imprest_expenses", "pre_sales", "pre_sale_installments", "alerts_log", "users", "timesheets", "payrolls"];
        for (const table of tables) {
          batchQueries.push(env.DB.prepare(`DELETE FROM ${table}`));
        }

        // 2. Insert Companies
        for (const item of incomingDb.companies || []) {
          batchQueries.push(env.DB.prepare("INSERT INTO companies (id, name, code) VALUES (?, ?, ?)").bind(item.id, item.name, item.code || null));
        }

        // 3. Insert Projects
        for (const item of incomingDb.projects || []) {
          const stagesStr = JSON.stringify(item.stages || ["خاک‌برداری", "اسکلت", "سفت‌کاری", "تأسیسات", "نازک‌کاری", "نما", "پایان کار"]);
          batchQueries.push(env.DB.prepare(`
            INSERT INTO projects (id, company_id, name, address, total_area, budget, stages, current_stage, status, is_deleted, deleted_at, number_of_units, default_unit_area, default_price_per_meter, blocks_json, supervisor_name, building_specs_json, unit_specs_json, extra_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.companyId || "c1",
            item.name,
            item.address || null,
            Number(item.totalArea || 0),
            Number(item.budget || 0),
            stagesStr,
            item.currentStage || "خاک‌برداری",
            item.status || "active",
            item.isDeleted ? 1 : 0,
            item.deletedAt || null,
            item.numberOfUnits !== undefined ? Number(item.numberOfUnits) : (item.totalUnits !== undefined ? Number(item.totalUnits) : null),
            item.defaultUnitArea !== undefined ? Number(item.defaultUnitArea) : null,
            item.defaultUnitPrice !== undefined ? Number(item.defaultUnitPrice) : null,
            item.blocks ? JSON.stringify(item.blocks) : null,
            item.supervisorName || null,
            item.buildingSpecs ? JSON.stringify(item.buildingSpecs) : null,
            item.unitSpecs ? JSON.stringify(item.unitSpecs) : null,
            JSON.stringify(item)
          ));
        }

        // 4. Insert Accounts
        for (const item of incomingDb.accounts || []) {
          batchQueries.push(env.DB.prepare(`
            INSERT INTO accounts (id, name, type, type_name, account_number, bank_name, balance, code, level, parent_code, nature, project_id, extra_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.name,
            item.type || "bank",
            item.typeName || "حساب",
            item.accountNumber || null,
            item.bankName || null,
            Number(item.balance || 0),
            item.code || null,
            item.level !== undefined ? Number(item.level) : null,
            item.parentCode || null,
            item.nature || null,
            item.projectId || null,
            JSON.stringify(item)
          ));
        }

        // 5. Insert Contacts
        for (const item of incomingDb.contacts || []) {
          batchQueries.push(env.DB.prepare(`
            INSERT INTO contacts (id, name, phone, role, role_name, roles_json, national_id, bank_card_number, bank_name, bank_iban, job_category, payment_method, barter_units_json, balance, created_at, project_id, extra_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.name,
            item.phone || "",
            item.role || "pre_buyer",
            item.roleName || null,
            item.roles ? JSON.stringify(item.roles) : null,
            item.nationalId || null,
            item.bankCardNumber || null,
            item.bankName || null,
            item.bankIBAN || null,
            item.jobCategory || null,
            item.paymentMethod || "cash",
            item.barterUnits ? JSON.stringify(item.barterUnits) : null,
            Number(item.balance || 0),
            item.createdAt || getTodayShamsiWorker(),
            item.projectId || null,
            JSON.stringify(item)
          ));
        }

        // 6. Insert Imprest Funds
        for (const item of incomingDb.imprestFunds || []) {
          batchQueries.push(env.DB.prepare(`
            INSERT INTO imprest_funds (id, project_id, contact_id, allocated_limit, balance, status, last_reconciliation_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.projectId,
            item.contactId,
            Number(item.allocatedLimit || 0),
            Number(item.balance !== undefined ? item.balance : (item.allocatedLimit || 0)),
            item.status || "active",
            item.lastReconciliationDate || getTodayShamsiWorker(),
            item.createdAt || getTodayShamsiWorker()
          ));
        }

        // 7. Insert Imprest Expenses
        for (const item of incomingDb.imprestExpenses || []) {
          batchQueries.push(env.DB.prepare(`
            INSERT INTO imprest_expenses (id, imprest_id, expense_date, amount, invoice_number, description, material_category, attachment_url, status, created_at, contact_id, person_name, stage, payment_status, attachment_name, attachment_data, payments_json, extra_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.imprestId,
            item.expenseDate || getTodayShamsiWorker(),
            Number(item.amount || 0),
            item.invoiceNumber || null,
            item.description || "",
            item.materialCategory || "سایر",
            item.attachmentUrl || null,
            item.status || "approved",
            item.createdAt || getTodayShamsiWorker(),
            item.contactId || null,
            item.personName || null,
            item.stage || null,
            item.paymentStatus || "paid",
            item.attachmentName || null,
            item.attachmentData || null,
            item.payments ? JSON.stringify(item.payments) : null,
            JSON.stringify(item)
          ));
        }

        // 8. Insert Pre-Sales
        for (const item of incomingDb.preSales || []) {
          batchQueries.push(env.DB.prepare(`
            INSERT INTO pre_sales (id, project_id, contact_id, unit_id, block_name, sale_area_type, useful_area, storage_area, parking_area, common_area, contract_area, price_per_meter, total_price, contract_date, status, has_exact_area, exact_area, secondary_price_per_meter, extra_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.projectId,
            item.contactId,
            item.unitId,
            item.blockName || null,
            item.saleAreaType || "useful",
            item.usefulArea !== undefined ? Number(item.usefulArea) : null,
            item.storageArea !== undefined ? Number(item.storageArea) : null,
            item.parkingArea !== undefined ? Number(item.parkingArea) : null,
            item.commonArea !== undefined ? Number(item.commonArea) : null,
            Number(item.contractArea || 0),
            Number(item.pricePerMeter || 0),
            Number(item.totalPrice || 0),
            item.contractDate || getTodayShamsiWorker(),
            item.status || "active",
            item.hasExactArea ? 1 : 0,
            item.exactArea !== undefined && item.exactArea !== null ? Number(item.exactArea) : null,
            item.secondaryPricePerMeter !== undefined && item.secondaryPricePerMeter !== null ? Number(item.secondaryPricePerMeter) : null,
            JSON.stringify(item)
          ));
        }

        // 9. Insert Pre-Sale Installments
        for (const item of incomingDb.preSaleInstallments || []) {
          batchQueries.push(env.DB.prepare(`
            INSERT INTO pre_sale_installments (id, pre_sale_id, installment_name, due_date, amount, is_paid, paid_date, paid_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.preSaleId,
            item.installmentName,
            item.dueDate,
            Number(item.amount || 0),
            item.isPaid ? 1 : 0,
            item.paidDate || null,
            Number(item.paidAmount || item.amountPaid || 0)
          ));
        }

        // 10. Insert Materials
        for (const item of incomingDb.materials || []) {
          batchQueries.push(env.DB.prepare(`
            INSERT INTO materials (id, name, category, unit, stock, average_price, code, sub_category, secondary_unit, conversion_factor, consumption_type, min_stock, purchase_price, project_id, extra_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.name,
            item.category || "عمومی",
            item.unit || "عدد",
            Number(item.stock || 0),
            Number(item.averagePrice || 0),
            item.code || null,
            item.subCategory || null,
            item.secondaryUnit || null,
            item.conversionFactor !== undefined ? Number(item.conversionFactor) : null,
            item.consumptionType || null,
            item.minStock !== undefined ? Number(item.minStock) : null,
            item.purchasePrice !== undefined ? Number(item.purchasePrice) : null,
            item.projectId || null,
            JSON.stringify(item)
          ));
        }

        // 11. Insert Material Transactions
        for (const item of incomingDb.materialTransactions || []) {
          batchQueries.push(env.DB.prepare(`
            INSERT INTO material_transactions (id, project_id, material_id, type, quantity, unit_price, date, person_name, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.projectId,
            item.materialId,
            item.type,
            Number(item.quantity || 0),
            Number(item.unitPrice || 0),
            item.date || "",
            item.personName || "",
            item.description || ""
          ));
        }

        // 12. Insert Transactions
        for (const item of incomingDb.transactions || []) {
          const isNonCashVal = item.isNonCash ? 1 : 0;
          const barterPropType = item.barterDetails ? item.barterDetails.propertyType : null;
          const barterDesc = item.barterDetails ? item.barterDetails.description : null;
          const barterValue = item.barterDetails ? Number(item.barterDetails.agreedValue || 0) : null;
          batchQueries.push(env.DB.prepare(`
            INSERT INTO transactions (id, company_id, project_id, type, category, sub_category, amount, account_id, person_name, date, description, invoice_number, is_non_cash, barter_property_type, barter_description, barter_agreed_value, attachment_name, attachment_data, approval_status, approved_amount, approved_by, approved_date, pre_sale_id, contact_id, payment_status, payments_json, extra_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.companyId || "c1",
            item.projectId,
            item.type,
            item.category,
            item.subCategory || null,
            Number(item.amount || 0),
            item.accountId || null,
            item.personName,
            item.date || "",
            item.description || "",
            item.invoiceNumber || null,
            isNonCashVal,
            barterPropType,
            barterDesc,
            barterValue,
            item.attachmentName || null,
            item.attachmentData || null,
            item.approvalStatus || "approved",
            item.approvedAmount !== undefined && item.approvedAmount !== null ? Number(item.approvedAmount) : null,
            item.approvedBy || null,
            item.approvedDate || null,
            item.preSaleId || null,
            item.contactId || null,
            item.paymentStatus || "paid",
            item.payments ? JSON.stringify(item.payments) : null,
            JSON.stringify(item)
          ));
        }

        // 13. Insert Checks
        for (const item of incomingDb.checks || []) {
          batchQueries.push(env.DB.prepare(`
            INSERT INTO checks (id, company_id, project_id, check_number, bank_name, due_date, amount, type, status, person_name, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.companyId || "c1",
            item.projectId,
            item.checkNumber,
            item.bankName,
            item.dueDate,
            Number(item.amount || 0),
            item.type,
            item.status || "pending",
            item.personName,
            item.description || ""
          ));
        }

        // 14. Insert Units
        for (const item of incomingDb.units || []) {
          const specExpStr = JSON.stringify(item.specificExpenses || []);
          batchQueries.push(env.DB.prepare(`
            INSERT INTO units (id, project_id, unit_number, block_name, floor, sale_area_type, useful_area, storage_area, parking_area, common_area, area, price_per_meter, total_price, status, buyer_name, contact_id, contract_id, down_payment, barter_property, specific_expenses, is_deleted, deleted_at, extra_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.projectId,
            item.unitNumber,
            item.blockName || null,
            item.floor || null,
            item.saleAreaType || "useful",
            item.usefulArea !== undefined ? Number(item.usefulArea) : null,
            item.storageArea !== undefined ? Number(item.storageArea) : null,
            item.parkingArea !== undefined ? Number(item.parkingArea) : null,
            item.commonArea !== undefined ? Number(item.commonArea) : null,
            Number(item.area || 0),
            Number(item.pricePerMeter || 0),
            Number(item.totalPrice || 0),
            item.status || "available",
            item.buyerName || null,
            item.contactId || null,
            item.contractId || null,
            item.downPayment !== null && item.downPayment !== undefined ? Number(item.downPayment) : null,
            item.barterProperty || null,
            specExpStr,
            item.isDeleted ? 1 : 0,
            item.deletedAt || null,
            JSON.stringify(item)
          ));
        }

        // 15. Insert Users
        if (incomingDb.users && Array.isArray(incomingDb.users) && incomingDb.users.length > 0) {
          for (const item of incomingDb.users) {
            batchQueries.push(env.DB.prepare(`
              INSERT INTO users (id, name, role, role_name, username, password, permissions)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
              item.id,
              item.name,
              item.role || "supervisor",
              item.roleName || "ناظر پروژه",
              item.username || null,
              item.password || null,
              item.permissions ? JSON.stringify(item.permissions) : null
            ));
          }
        } else {
          batchQueries.push(env.DB.prepare(`
            INSERT INTO users (id, name, role, role_name, username, password)
            VALUES ('u1', 'مهندس میلاد فرخی', 'manager', 'مدیر ارشد پروژه', 'admin', 'Miladlar224')
          `));
        }

        // 16. Insert Timesheets
        if (incomingDb.timesheets && Array.isArray(incomingDb.timesheets)) {
          for (const item of incomingDb.timesheets) {
            batchQueries.push(env.DB.prepare(`
              INSERT INTO timesheets (id, project_id, contact_id, person_name, date, hours_worked, overtime_hours, daily_rate, overtime_rate, total_pay, stage, description, is_paid)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              item.id,
              item.projectId || null,
              item.contactId || null,
              item.personName || "",
              item.date || "",
              Number(item.hoursWorked || 0),
              Number(item.overtimeHours || 0),
              Number(item.dailyRate || 0),
              Number(item.overtimeRate || 0),
              Number(item.totalPay || item.totalAmount || 0),
              item.stage || null,
              item.description || "",
              item.isPaid ? 1 : 0
            ));
          }
        }

        // 17. Insert Payrolls
        if (incomingDb.payrolls && Array.isArray(incomingDb.payrolls)) {
          for (const item of incomingDb.payrolls) {
            batchQueries.push(env.DB.prepare(`
              INSERT INTO payrolls (id, project_id, contact_id, person_name, month, year, base_salary, housing_allowance, food_allowance, child_allowance, overtime_hours, overtime_pay, bonuses, insurance_worker, insurance_employer, tax_deduction, advance_deduction, other_deductions, gross_salary, net_payable, payment_date, account_id, is_paid)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              item.id,
              item.projectId || null,
              item.contactId || null,
              item.personName || "",
              item.month || "",
              item.year || "",
              Number(item.baseSalary || 0),
              Number(item.housingAllowance || 0),
              Number(item.foodAllowance || 0),
              Number(item.childAllowance || 0),
              Number(item.overtimeHours || 0),
              Number(item.overtimePay || 0),
              Number(item.bonuses || 0),
              Number(item.insuranceWorker || 0),
              Number(item.insuranceEmployer || 0),
              Number(item.taxDeduction || 0),
              Number(item.advanceDeduction || 0),
              Number(item.otherDeductions || 0),
              Number(item.grossSalary || 0),
              Number(item.netPayable || item.amount || 0),
              item.paymentDate || "",
              item.accountId || null,
              item.isPaid ? 1 : 0
            ));
          }
        }

        const chunkSize = 100;
        for (let i = 0; i < batchQueries.length; i += chunkSize) {
          const chunk = batchQueries.slice(i, i + chunkSize);
          await env.DB.batch(chunk);
        }

        // Automatically record a versioned backup snapshot in D1 with exact date & time
        let backupSnapshot = null;
        if (!incomingDb._skipBackupSnapshot) {
          const sourceLabel = incomingDb._backupSource || "به‌روزرسانی و همگام‌سازی از نسخه آفلاین";
          backupSnapshot = await createCloudBackupSnapshot(env, incomingDb, sourceLabel);
        }

        return new Response(JSON.stringify({ 
          status: "success", 
          message: "دیتابیس ابری با داده‌های آفلاین همگام‌سازی شد و بکاپ نسخه‌بندی‌شده ثبت گردید.",
          backupVersion: backupSnapshot,
          statistics: {
            projects: incomingDb.projects.length,
            transactions: incomingDb.transactions.length
          }
        }), { headers: corsHeaders });
      }

      // 2c. List Versioned Cloud Backups (Ordered by Date & Time DESC)
      if (path === "/api/backups" && method === "GET") {
        await ensureDatabaseSchema(env);
        const { results } = await env.DB.prepare(
          "SELECT id, version_name, shamsi_date, shamsi_time, created_at, source, stats_json FROM backups ORDER BY created_at DESC LIMIT 30"
        ).all();
        const versions = (results || []).map(r => {
          let stats = {};
          try { stats = r.stats_json ? JSON.parse(r.stats_json) : {}; } catch {}
          return {
            id: r.id,
            versionName: r.version_name,
            shamsiDate: r.shamsi_date,
            shamsiTime: r.shamsi_time,
            createdAt: r.created_at,
            source: r.source,
            location: "cloud",
            stats
          };
        });
        return new Response(JSON.stringify({ status: "success", versions }), { headers: corsHeaders });
      }

      // 2d. Get Specific Cloud Backup Version Data by ID
      if (path.startsWith("/api/backups/") && method === "GET") {
        await ensureDatabaseSchema(env);
        const versionId = decodeURIComponent(path.substring("/api/backups/".length));
        const row = await env.DB.prepare("SELECT * FROM backups WHERE id = ?").bind(versionId).first();
        if (!row) {
          return new Response(JSON.stringify({ error: "نسخه پشتیبان مورد نظر در فضای ابری یافت نشد" }), { status: 404, headers: corsHeaders });
        }
        let dbData = null;
        let stats = {};
        try { dbData = JSON.parse(row.db_json); } catch {}
        try { stats = row.stats_json ? JSON.parse(row.stats_json) : {}; } catch {}
        return new Response(JSON.stringify({
          status: "success",
          version: {
            id: row.id,
            versionName: row.version_name,
            shamsiDate: row.shamsi_date,
            shamsiTime: row.shamsi_time,
            createdAt: row.created_at,
            source: row.source,
            location: "cloud",
            stats
          },
          db: dbData
        }), { headers: corsHeaders });
      }

      // 2e. Create Explicit Cloud Backup Snapshot
      if ((path === "/api/backups" || path === "/api/backups/create") && method === "POST") {
        await ensureDatabaseSchema(env);
        const body = await request.json();
        const dbData = body.db || body;
        const sourceLabel = body.source || "بکاپ دستی/خودکار در فضای ابری";
        const snapshot = await createCloudBackupSnapshot(env, dbData, sourceLabel);
        return new Response(JSON.stringify({ status: "success", backupVersion: snapshot, localVersion: snapshot }), { headers: corsHeaders });
      }

      // 2f. Delete Specific Cloud Backup Version
      if (path === "/api/backups/delete" && method === "POST") {
        await ensureDatabaseSchema(env);
        const { id } = await request.json();
        await env.DB.prepare("DELETE FROM backups WHERE id = ?").bind(id).run();
        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      // 3. Reset/Clear D1 database (Empty Default State - No Fake Data)
      if (path === "/api/db/reset" && method === "POST") {
        await ensureDatabaseSchema(env);
        const tables = ["companies", "projects", "accounts", "materials", "material_transactions", "transactions", "checks", "units", "contacts", "imprest_funds", "imprest_expenses", "pre_sales", "pre_sale_installments", "alerts_log", "timesheets", "payrolls"];
        for (const table of tables) {
          await env.DB.prepare(`DELETE FROM ${table}`).run().catch(() => {});
        }
        await env.DB.prepare("DELETE FROM users").run().catch(() => {});
        await env.DB.prepare("INSERT INTO users (id, name, role, role_name, username, password) VALUES ('u1', 'مهندس میلاد فرخی', 'manager', 'مدیر ارشد پروژه', 'admin', 'Miladlar224')").run().catch(() => {});

        return new Response(JSON.stringify({ status: "success", message: "پایگاه داده ابری کلودفلر به صورت کامل پاکسازی و خالی شد." }), { headers: corsHeaders });
      }

      // 3.5 Create or Update Company
      if (path === "/api/companies" && method === "POST") {
        const body = await request.json();
        const id = body.id || "c_" + Date.now();
        const name = body.name;
        const code = body.code || String(Math.floor(Math.random() * 90000) + 10000);

        await env.DB.prepare(`
          INSERT INTO companies (id, name, code)
          VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            code = excluded.code
        `).bind(id, name, code).run();

        return new Response(JSON.stringify({ status: "success", id: id }), { headers: corsHeaders });
      }

      // 3.6 Delete Company
      if (path === "/api/companies/delete" && method === "POST") {
        const body = await request.json();
        const { id } = body;

        await env.DB.prepare("DELETE FROM companies WHERE id = ?").bind(id).run();

        return new Response(JSON.stringify({ status: "success", message: "شرکت با موفقیت حذف شد." }), { headers: corsHeaders });
      }

      // Delete Project (Soft Delete)
      if (path === "/api/projects/delete" && method === "POST") {
        const body = await request.json();
        const { id } = body;
        const now = new Date().toISOString();

        // Soft delete project and its units so restore preserves accounting history
        await env.DB.prepare("UPDATE projects SET is_deleted = 1, deleted_at = ? WHERE id = ?").bind(now, id).run();
        await env.DB.prepare("UPDATE units SET is_deleted = 1, deleted_at = ? WHERE project_id = ?").bind(now, id).run();

        return new Response(JSON.stringify({ status: "success", message: "پروژه به سطل زباله منتقل شد و در صورت نیاز قابل بازیابی است" }), { headers: corsHeaders });
      }

      // Restore Project
      if (path === "/api/projects/restore" && method === "POST") {
        const body = await request.json();
        const { id } = body;
        await env.DB.prepare("UPDATE projects SET is_deleted = 0 WHERE id = ?").bind(id).run();
        await env.DB.prepare("UPDATE units SET is_deleted = 0 WHERE project_id = ?").bind(id).run();
        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      // Restore Unit
      if (path === "/api/units/restore" && method === "POST") {
        const body = await request.json();
        const { id } = body;
        await env.DB.prepare("UPDATE units SET is_deleted = 0 WHERE id = ?").bind(id).run();
        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      // Delete Account
      if (path === "/api/accounts/delete" && method === "POST") {
        const body = await request.json();
        const { id } = body;
        const { results } = await env.DB.prepare("SELECT * FROM accounts WHERE id = ?").bind(id).all();
        if (results && results.length > 0) {
          await env.DB.prepare("DELETE FROM accounts WHERE id = ?").bind(id).run();
          return new Response(JSON.stringify({ status: "success", message: "حساب مالی با موفقیت حذف شد" }), { headers: corsHeaders });
        } else {
          return new Response(JSON.stringify({ error: "حساب مالی یافت نشد" }), { status: 404, headers: corsHeaders });
        }
      }

      // Delete Material or Warehouse Transaction
      if (path === "/api/materials/delete" && method === "POST") {
        const body = await request.json();
        const { id, isTransaction } = body;

        if (isTransaction) {
          const { results: txs } = await env.DB.prepare("SELECT * FROM material_transactions WHERE id = ?").bind(id).all();
          if (txs && txs.length > 0) {
            const tx = txs[0];
            const { results: mats } = await env.DB.prepare("SELECT * FROM materials WHERE id = ?").bind(tx.material_id).all();
            if (mats && mats.length > 0) {
              const mat = mats[0];
              let newStock = mat.stock;
              if (tx.type === "in") {
                newStock = Math.max(0, mat.stock - tx.quantity);
              } else {
                newStock = mat.stock + tx.quantity;
              }
              await env.DB.prepare("UPDATE materials SET stock = ? WHERE id = ?").bind(newStock, tx.material_id).run();
            }
            await env.DB.prepare("DELETE FROM material_transactions WHERE id = ?").bind(id).run();
            return new Response(JSON.stringify({ status: "success", message: "تراکنش انبار با موفقیت حذف شد" }), { headers: corsHeaders });
          } else {
            return new Response(JSON.stringify({ error: "تراکنش انبار یافت نشد" }), { status: 404, headers: corsHeaders });
          }
        } else {
          const { results: mats } = await env.DB.prepare("SELECT * FROM materials WHERE id = ?").bind(id).all();
          if (mats && mats.length > 0) {
            await env.DB.prepare("DELETE FROM materials WHERE id = ?").bind(id).run();
            await env.DB.prepare("DELETE FROM material_transactions WHERE material_id = ?").bind(id).run();
            return new Response(JSON.stringify({ status: "success", message: "کالای انبار به همراه تمامی تراکنش‌های مربوطه با موفقیت حذف شد" }), { headers: corsHeaders });
          } else {
            return new Response(JSON.stringify({ error: "کالای انبار یافت نشد" }), { status: 404, headers: corsHeaders });
          }
        }
      }

      // Delete Contact
      if (path === "/api/contacts/delete" && method === "POST") {
        const body = await request.json();
        const { id } = body;
        if (!id) {
          return new Response(JSON.stringify({ error: "شناسه طرف حساب وارد نشده است" }), { status: 400, headers: corsHeaders });
        }

        // Fetch contact name for possible units rollback
        const { results: contactResults } = await env.DB.prepare("SELECT name FROM contacts WHERE id = ?").bind(id).all();
        const contactName = contactResults && contactResults.length > 0 ? contactResults[0].name : null;

        // 1. Delete contact
        await env.DB.prepare("DELETE FROM contacts WHERE id = ?").bind(id).run();

        // 2. Clear preSales and update corresponding units
        const { results: preSales } = await env.DB.prepare("SELECT id, unit_id FROM pre_sales WHERE contact_id = ?").bind(id).all();
        const psIds = (preSales || []).map(ps => ps.id);
        const psUnitIds = (preSales || []).map(ps => ps.unit_id);

        if (psIds.length > 0) {
          await env.DB.prepare("DELETE FROM pre_sales WHERE contact_id = ?").bind(id).run();
          for (const psId of psIds) {
            await env.DB.prepare("DELETE FROM pre_sale_installments WHERE pre_sale_id = ?").bind(psId).run();
          }
        }

        // Update units to be available
        if (psUnitIds.length > 0) {
          for (const uId of psUnitIds) {
            await env.DB.prepare("UPDATE units SET status = 'available', buyer_name = NULL, down_payment = NULL, barter_property = NULL WHERE id = ?").bind(uId).run();
          }
        }

        // Update other units where buyer_name matches contact name
        if (contactName) {
          await env.DB.prepare("UPDATE units SET status = 'available', buyer_name = NULL, down_payment = NULL, barter_property = NULL WHERE buyer_name = ?").bind(contactName).run();
        }

        // 3. Clear imprestFunds and their expenses
        const { results: imprestFunds } = await env.DB.prepare("SELECT id FROM imprest_funds WHERE contact_id = ?").bind(id).all();
        const impIds = (imprestFunds || []).map(f => f.id);
        if (impIds.length > 0) {
          await env.DB.prepare("DELETE FROM imprest_funds WHERE contact_id = ?").bind(id).run();
          for (const impId of impIds) {
            await env.DB.prepare("DELETE FROM imprest_expenses WHERE imprest_id = ?").bind(impId).run();
          }
        }

        return new Response(JSON.stringify({ status: "success", message: "طرف حساب با موفقیت حذف شد" }), { headers: corsHeaders });
      }

      // Approve/Reject Transaction
      if (path === "/api/transactions/approve" && method === "POST") {
        const body = await request.json();
        const { id, approvalStatus, approvedAmount, approvedBy, approvedDate } = body;
        
        if (!id) {
          return new Response(JSON.stringify({ error: "شناسه تراکنش الزامی است" }), { status: 400, headers: corsHeaders });
        }
        
        await env.DB.prepare(`
          UPDATE transactions
          SET approval_status = ?, approved_amount = ?, approved_by = ?, approved_date = ?
          WHERE id = ?
        `).bind(
          approvalStatus || "approved",
          approvedAmount !== undefined ? Number(approvedAmount) : null,
          approvedBy || null,
          approvedDate || null,
          id
        ).run();
        
        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      // Delete Transaction
      if (path === "/api/transactions/delete" && method === "POST") {
        const body = await request.json();
        const { id } = body;
        const { results: txs } = await env.DB.prepare("SELECT * FROM transactions WHERE id = ?").bind(id).all();
        if (txs && txs.length > 0) {
          const tx = txs[0];
          // Revert balance
          if (tx.is_non_cash !== 1 && tx.account_id) {
            const amount = Number(tx.amount || 0);
            if (tx.type === "expense") {
              await env.DB.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(amount, tx.account_id).run();
            } else {
              await env.DB.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").bind(amount, tx.account_id).run();
            }
          }
          await env.DB.prepare("DELETE FROM transactions WHERE id = ?").bind(id).run();
          return new Response(JSON.stringify({ status: "success", message: "تراکنش با موفقیت حذف گردید" }), { headers: corsHeaders });
        } else {
          return new Response(JSON.stringify({ error: "تراکنش یافت نشد" }), { status: 404, headers: corsHeaders });
        }
      }

      // Delete Check
      if (path === "/api/checks/delete" && method === "POST") {
        const body = await request.json();
        const { id } = body;
        const chk = await env.DB.prepare("SELECT * FROM checks WHERE id = ?").bind(id).first();
        if (chk && chk.status === "passed") {
          const { results: matchedTxs } = await env.DB.prepare(
            "SELECT * FROM transactions WHERE category = 'پاس شدن چک' AND amount = ? AND description LIKE ?"
          ).bind(chk.amount, `%${chk.check_number}%`).all();
          if (matchedTxs && matchedTxs.length > 0) {
            const tx = matchedTxs[0];
            if (tx.account_id) {
              const revDiff = tx.type === "expense" ? Number(tx.amount) : -Number(tx.amount);
              await env.DB.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(revDiff, tx.account_id).run();
            }
            await env.DB.prepare("DELETE FROM transactions WHERE id = ?").bind(tx.id).run();
          }
        }
        await env.DB.prepare("DELETE FROM checks WHERE id = ?").bind(id).run();
        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      // Delete Unit
      if (path === "/api/units/delete" && method === "POST") {
        const body = await request.json();
        const { id } = body;
        const now = new Date().toISOString();
        await env.DB.prepare("UPDATE units SET is_deleted = 1, deleted_at = ? WHERE id = ?").bind(now, id).run();
        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      // Delete User
      if (path === "/api/users/delete" && method === "POST") {
        const body = await request.json();
        const { id } = body;
        await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
        return new Response(JSON.stringify({ status: "success", message: "کاربر با موفقیت حذف شد" }), { headers: corsHeaders });
      }

      // Delete Imprest Fund
      if (path === "/api/imprests/delete" && method === "POST") {
        const body = await request.json();
        const { id } = body;
        await env.DB.prepare("DELETE FROM imprest_funds WHERE id = ?").bind(id).run();
        await env.DB.prepare("DELETE FROM imprest_expenses WHERE imprest_id = ?").bind(id).run();
        return new Response(JSON.stringify({ status: "success", message: "تنخواه‌گردان با موفقیت حذف شد" }), { headers: corsHeaders });
      }

      // Delete Imprest Expense
      if (path === "/api/imprests/expenses/delete" && method === "POST") {
        const body = await request.json();
        const { id } = body;
        const { results: expenses } = await env.DB.prepare("SELECT * FROM imprest_expenses WHERE id = ?").bind(id).all();
        if (expenses && expenses.length > 0) {
          const expense = expenses[0];
          const amount = Number(expense.amount || 0);
          const { results: funds } = await env.DB.prepare("SELECT * FROM imprest_funds WHERE id = ?").bind(expense.imprest_id).all();
          if (funds && funds.length > 0) {
            const fund = funds[0];
            await env.DB.prepare("UPDATE imprest_funds SET balance = balance + ? WHERE id = ?").bind(amount, fund.id).run();
          }
          const tx = await env.DB.prepare("SELECT * FROM transactions WHERE id = ?").bind("t_im_exp_" + id).first();
          if (tx) {
            if (tx.account_id) {
              await env.DB.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(amount, tx.account_id).run();
            }
            await env.DB.prepare("DELETE FROM transactions WHERE id = ?").bind(tx.id).run();
          }
          await env.DB.prepare("DELETE FROM imprest_expenses WHERE id = ?").bind(id).run();
          return new Response(JSON.stringify({ status: "success", message: "هزینه تنخواه با موفقیت حذف شد" }), { headers: corsHeaders });
        } else {
          return new Response(JSON.stringify({ error: "هزینه تنخواه یافت نشد" }), { status: 404, headers: corsHeaders });
        }
      }

      // Delete Pre-Sale Contract
      if (path === "/api/presales/delete" && method === "POST") {
        const body = await request.json();
        const { id } = body;
        const { results: preSales } = await env.DB.prepare("SELECT * FROM pre_sales WHERE id = ?").bind(id).all();
        if (preSales && preSales.length > 0) {
          const presale = preSales[0];
          await env.DB.prepare("UPDATE units SET status = 'available', buyer_name = NULL, down_payment = NULL WHERE id = ?").bind(presale.unit_id).run();
          const { results: paidInsts } = await env.DB.prepare("SELECT * FROM pre_sale_installments WHERE pre_sale_id = ? AND is_paid = 1").bind(id).all();
          const totalPaid = (paidInsts || []).reduce((sum, i) => sum + Number(i.amount || 0), 0);
          const remainingDebt = Math.max(0, Number(presale.total_price || 0) - totalPaid);
          if (presale.contact_id) {
            await env.DB.prepare("UPDATE contacts SET balance = MAX(0, balance - ?) WHERE id = ?").bind(remainingDebt, presale.contact_id).run();
          }
          await env.DB.prepare("DELETE FROM pre_sale_installments WHERE pre_sale_id = ?").bind(id).run();
          await env.DB.prepare("DELETE FROM pre_sales WHERE id = ?").bind(id).run();

          return new Response(JSON.stringify({ status: "success", message: "قرارداد پیش‌فروش با موفقیت حذف شد" }), { headers: corsHeaders });
        } else {
          return new Response(JSON.stringify({ error: "قرارداد پیش‌فروش یافت نشد" }), { status: 404, headers: corsHeaders });
        }
      }

      // Update Pre-Sale Exact Area & Secondary Price (Deed settlement)
      if (path === "/api/presales/update-area" && method === "POST") {
        const body = await request.json();
        const { id, exactArea, secondaryPricePerMeter, hasExactArea } = body;
        const presale = await env.DB.prepare("SELECT * FROM pre_sales WHERE id = ?").bind(id).first();
        if (!presale) {
          return new Response(JSON.stringify({ error: "قرارداد پیش‌فروش یافت نشد" }), { status: 404, headers: corsHeaders });
        }

        const prevTotalPrice = Number(presale.total_price || 0);
        const contractArea = Number(presale.contract_area || 0);
        const pricePerMeter = Number(presale.price_per_meter || 0);

        let newTotalPrice = Math.round(contractArea * pricePerMeter);
        let exactAreaVal = null;
        let secPriceVal = null;
        const hasExactVal = hasExactArea ? 1 : 0;

        if (hasExactArea) {
          exactAreaVal = Number(exactArea || contractArea);
          secPriceVal = Number(secondaryPricePerMeter || pricePerMeter);
          const diffArea = exactAreaVal - contractArea;
          const adjustment = diffArea * secPriceVal;
          newTotalPrice = Math.round((contractArea * pricePerMeter) + adjustment);
        }

        const diffAmount = newTotalPrice - prevTotalPrice;

        await env.DB.prepare(`
          UPDATE pre_sales
          SET has_exact_area = ?, exact_area = ?, secondary_price_per_meter = ?, total_price = ?
          WHERE id = ?
        `).bind(hasExactVal, exactAreaVal, secPriceVal, newTotalPrice, id).run();

        if (hasExactArea && exactAreaVal) {
          await env.DB.prepare("UPDATE units SET area = ?, total_price = ? WHERE id = ?")
            .bind(exactAreaVal, newTotalPrice, presale.unit_id).run();
        }

        // Adjust deed/final installment
        const { results: insts } = await env.DB.prepare("SELECT * FROM pre_sale_installments WHERE pre_sale_id = ? ORDER BY due_date ASC").bind(id).all();
        if (insts && insts.length > 0) {
          let targetInst = insts.find(i =>
            (i.installment_name || "").includes("سند") ||
            (i.installment_name || "").includes("دفترخانه") ||
            (i.installment_name || "").includes("نهایی")
          ) || insts[insts.length - 1];
          const updatedInstAmount = Math.max(0, Number(targetInst.amount || 0) + diffAmount);
          await env.DB.prepare("UPDATE pre_sale_installments SET amount = ? WHERE id = ?").bind(updatedInstAmount, targetInst.id).run();
        }

        if (presale.contact_id) {
          await env.DB.prepare("UPDATE contacts SET balance = MAX(0, COALESCE(balance, 0) + ?) WHERE id = ?")
            .bind(diffAmount, presale.contact_id).run();
        }

        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      // Add Custom Pre-Sale Installment
      if (path === "/api/presales/installments/add" && method === "POST") {
        const body = await request.json();
        const { preSaleId, installmentName, dueDate, amount } = body;
        const instId = "psi_custom_" + Date.now();
        await env.DB.prepare(`
          INSERT INTO pre_sale_installments (id, pre_sale_id, installment_name, due_date, amount, is_paid, paid_date)
          VALUES (?, ?, ?, ?, ?, 0, NULL)
        `).bind(instId, preSaleId, installmentName, dueDate, Number(amount || 0)).run();

        const presale = await env.DB.prepare("SELECT * FROM pre_sales WHERE id = ?").bind(preSaleId).first();
        if (presale && presale.contact_id) {
          await env.DB.prepare("UPDATE contacts SET balance = COALESCE(balance, 0) + ? WHERE id = ?")
            .bind(Number(amount || 0), presale.contact_id).run();
        }
        return new Response(JSON.stringify({ status: "success", id: instId }), { headers: corsHeaders });
      }

      // Edit Pre-Sale Installment
      if (path === "/api/presales/installments/edit" && method === "POST") {
        const body = await request.json();
        const { installmentId, installmentName, dueDate, amount } = body;
        const inst = await env.DB.prepare("SELECT * FROM pre_sale_installments WHERE id = ?").bind(installmentId).first();
        if (!inst) {
          return new Response(JSON.stringify({ error: "قسط یافت نشد" }), { status: 404, headers: corsHeaders });
        }
        const diff = Number(amount || inst.amount) - Number(inst.amount || 0);
        await env.DB.prepare("UPDATE pre_sale_installments SET installment_name = ?, due_date = ?, amount = ? WHERE id = ?")
          .bind(installmentName || inst.installment_name, dueDate || inst.due_date, Number(amount || inst.amount), installmentId).run();

        const presale = await env.DB.prepare("SELECT * FROM pre_sales WHERE id = ?").bind(inst.pre_sale_id).first();
        if (presale && presale.contact_id) {
          await env.DB.prepare("UPDATE contacts SET balance = MAX(0, COALESCE(balance, 0) + ?) WHERE id = ?")
            .bind(diff, presale.contact_id).run();
        }
        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      // Delete Pre-Sale Installment
      if (path === "/api/presales/installments/delete" && method === "POST") {
        const body = await request.json();
        const { installmentId } = body;
        if (!installmentId) {
          return new Response(JSON.stringify({ error: "شناسه قسط مشخص نیست" }), { status: 400, headers: corsHeaders });
        }

        const { results: installments } = await env.DB.prepare("SELECT * FROM pre_sale_installments WHERE id = ?").bind(installmentId).all();
        if (!installments || installments.length === 0) {
          return new Response(JSON.stringify({ error: "قسط یافت نشد" }), { status: 404, headers: corsHeaders });
        }

        const inst = installments[0];
        if (inst.is_paid === 1) {
          return new Response(JSON.stringify({ error: "قسط پرداخت شده را نمی‌توان حذف کرد" }), { status: 400, headers: corsHeaders });
        }

        const { results: preSales } = await env.DB.prepare("SELECT * FROM pre_sales WHERE id = ?").bind(inst.pre_sale_id).all();
        if (preSales && preSales.length > 0) {
          const presale = preSales[0];
          const { results: buyers } = await env.DB.prepare("SELECT * FROM contacts WHERE id = ?").bind(presale.contact_id).all();
          if (buyers && buyers.length > 0) {
            const buyer = buyers[0];
            const newBal = Math.max(0, (buyer.balance || 0) - inst.amount);
            await env.DB.prepare("UPDATE contacts SET balance = ? WHERE id = ?").bind(newBal, buyer.id).run();
          }
        }

        await env.DB.prepare("DELETE FROM pre_sale_installments WHERE id = ?").bind(installmentId).run();
        return new Response(JSON.stringify({ status: "success", message: "قسط با موفقیت حذف شد" }), { headers: corsHeaders });
      }

      // Batch Generate Units
      if (path === "/api/units/batch" && method === "POST") {
        const body = await request.json();
        const { projectId, units } = body;
        if (!units || !Array.isArray(units)) {
          return new Response(JSON.stringify({ error: "Invalid units list" }), { status: 400, headers: corsHeaders });
        }

        const { results: existingUnits } = await env.DB.prepare("SELECT * FROM units WHERE project_id = ?").bind(projectId).all();
        const existingMap = new Map();
        for (const u of existingUnits || []) {
          existingMap.set(u.id, u);
          existingMap.set("num_" + u.unit_number, u);
        }

        const statements = [];
        for (const newU of units) {
          const uItemId = newU.id || "u_" + projectId + "_" + newU.unitNumber + "_" + Math.floor(Math.random() * 10000);
          const matchedUnitByNum = existingMap.get("num_" + newU.unitNumber);
          const matchedUnitById = existingMap.get(uItemId);
          const matchedUnit = matchedUnitById || matchedUnitByNum;

          if (matchedUnit) {
            statements.push(
              env.DB.prepare(`
                UPDATE units SET
                  floor = ?,
                  area = ?,
                  price_per_meter = ?,
                  total_price = ?,
                  status = CASE WHEN status = 'available' THEN ? ELSE status END,
                  buyer_name = COALESCE(buyer_name, ?),
                  down_payment = COALESCE(down_payment, ?)
                WHERE id = ?
              `).bind(
                String(newU.floor),
                Number(newU.area || 0),
                Number(newU.pricePerMeter || 0),
                Number(newU.area || 0) * Number(newU.pricePerMeter || 0),
                newU.status || "available",
                newU.buyerName || null,
                Number(newU.downPayment || 0),
                matchedUnit.id
              )
            );
          } else {
            statements.push(
              env.DB.prepare(`
                INSERT INTO units (id, project_id, unit_number, floor, area, price_per_meter, total_price, status, buyer_name, down_payment, barter_property, specific_expenses)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                uItemId,
                projectId,
                newU.unitNumber,
                String(newU.floor),
                Number(newU.area || 0),
                Number(newU.pricePerMeter || 0),
                Number(newU.area || 0) * Number(newU.pricePerMeter || 0),
                newU.status || "available",
                newU.buyerName || null,
                Number(newU.downPayment || 0),
                newU.barterProperty || null,
                JSON.stringify(newU.specificExpenses || [])
              )
            );
          }
        }

        if (statements.length > 0) {
          await env.DB.batch(statements);
        }

        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      // Add/Update Dynamic Users
      if (path === "/api/users" && method === "POST") {
        const body = await request.json();
        const id = body.id || "u_" + Date.now();
        const { name, role, roleName, username, password } = body;
        const permissionsJson = JSON.stringify(body.permissions || []);

        await env.DB.prepare(`
          INSERT INTO users (id, name, role, role_name, username, password, permissions)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            role = excluded.role,
            role_name = excluded.role_name,
            username = excluded.username,
            password = excluded.password,
            permissions = excluded.permissions
        `).bind(
          id,
          name,
          role || "supervisor",
          roleName || "ناظر پروژه",
          username ? username.trim() : "",
          password ? password.trim() : "",
          permissionsJson
        ).run();

        return new Response(JSON.stringify({ status: "success", user: { id, name, role, roleName, username, password, permissions: body.permissions || [] } }), { headers: corsHeaders });
      }

      // Get settings
      if (path === "/api/settings" && method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM settings").all();
        const settings = {};
        for (const row of results || []) {
          settings[row.key] = row.value;
        }
        return new Response(JSON.stringify(settings), { headers: corsHeaders });
      }

      // Save settings
      if (path === "/api/settings" && method === "POST") {
        const body = await request.json();
        const statements = [];
        for (const [key, value] of Object.entries(body)) {
          statements.push(
            env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, String(value))
          );
        }
        if (statements.length > 0) {
          await env.DB.batch(statements);
        }
        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      // 4. Create or Update Project
      if (path === "/api/projects" && method === "POST") {
        await ensureDatabaseSchema(env);
        const p = await request.json();
        const existingProj = p.id ? await env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(p.id).first() : null;
        const isNew = !existingProj;
        const pId = p.id || "p_" + Date.now();
        const stagesStr = JSON.stringify(p.stages || ["خاک‌برداری", "اسکلت", "سفت‌کاری", "تأسیسات", "نازک‌کاری", "نما", "پایان کار"]);
        let requestedUnitsCount = Number(p.numberOfUnits ?? p.totalUnits ?? existingProj?.number_of_units ?? 0);
        if (isNew && Array.isArray(p.generatedUnits) && p.generatedUnits.length > 0) {
          requestedUnitsCount = p.generatedUnits.length;
        } else if (Array.isArray(p.blocks) && p.blocks.length > 0 && requestedUnitsCount === 0) {
          requestedUnitsCount = p.blocks.reduce((sum, blk) => sum + (Number(blk.totalUnits) || ((Number(blk.floors) || 1) * (Number(blk.unitsPerFloor) || 2))), 0);
        }

        await env.DB.prepare(`
          INSERT INTO projects (id, company_id, name, address, total_area, budget, stages, current_stage, status, number_of_units, default_unit_area, default_price_per_meter, blocks_json, supervisor_name, building_specs_json, unit_specs_json, extra_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            address=excluded.address,
            total_area=excluded.total_area,
            budget=excluded.budget,
            stages=excluded.stages,
            current_stage=excluded.current_stage,
            status=excluded.status,
            number_of_units=excluded.number_of_units,
            default_unit_area=excluded.default_unit_area,
            default_price_per_meter=excluded.default_price_per_meter,
            blocks_json=excluded.blocks_json,
            supervisor_name=excluded.supervisor_name,
            building_specs_json=excluded.building_specs_json,
            unit_specs_json=excluded.unit_specs_json,
            extra_json=excluded.extra_json
        `).bind(
          pId,
          p.companyId || "c1",
          p.name,
          p.address || null,
          Number(p.totalArea || 0),
          Number(p.budget || 0),
          stagesStr,
          p.currentStage || "خاک‌برداری",
          p.status || "active",
          requestedUnitsCount,
          Number(p.defaultUnitArea || 0),
          Number(p.defaultUnitPrice || p.defaultPricePerMeter || 0),
          p.blocks ? JSON.stringify(p.blocks) : null,
          p.supervisorName || "مهندس میلاد فرخی",
          p.buildingSpecs ? JSON.stringify(p.buildingSpecs) : null,
          p.unitSpecs ? JSON.stringify(p.unitSpecs) : null,
          JSON.stringify({ ...p, numberOfUnits: requestedUnitsCount })
        ).run();

        // Auto-generate units based on automatic block structuring or requestedUnitsCount
        const defArea = Number(p.defaultUnitArea || 0);
        const defPrice = Number(p.defaultUnitPrice || p.defaultPricePerMeter || 0);
        const { results: currentUnits } = await env.DB.prepare("SELECT id, block_name FROM units WHERE project_id = ? AND (is_deleted IS NULL OR is_deleted = 0)").bind(pId).all();
        const activeList = currentUnits || [];
        const unitStmts = [];

        if (isNew && Array.isArray(p.generatedUnits) && p.generatedUnits.length > 0) {
          p.generatedUnits.forEach((gu, idx) => {
            const uId = "u_" + Date.now() + "_" + (idx + 1) + "_" + Math.floor(Math.random() * 1000);
            unitStmts.push(
              env.DB.prepare(`
                INSERT INTO units (id, project_id, unit_number, block_name, floor, sale_area_type, useful_area, storage_area, parking_area, common_area, area, price_per_meter, total_price, status, specific_expenses, is_deleted)
                VALUES (?, ?, ?, ?, ?, 'useful', ?, 0, 0, 0, ?, ?, ?, 'available', '[]', 0)
              `).bind(
                uId,
                pId,
                String(gu.unitNumber || (idx + 1)),
                String(gu.blockName || ""),
                String(gu.floor ?? "1"),
                defArea,
                defArea,
                defPrice,
                defArea * defPrice
              )
            );
          });
        } else if (Array.isArray(p.blocks) && p.blocks.length > 0 && (isNew || p.syncBlockUnits)) {
          const style = p.numberingStyle || "block_floor_unit_short";
          let globalSeq = activeList.length;

          p.blocks.forEach((blk) => {
            const bName = String(blk.name || "").trim();
            const floors = Math.max(0, Number(blk.floors ?? 4));
            const unitsPerFloor = Math.max(1, Number(blk.unitsPerFloor ?? 4));
            const groundUnits = Math.max(0, Number(blk.groundFloorUnits ?? 0));

            let floorConfigs = [];
            if (Array.isArray(blk.floorConfigs) && blk.floorConfigs.length > 0) {
              floorConfigs = blk.floorConfigs.map((fc) => ({
                floorNumber: Number(fc.floorNumber ?? 0),
                unitsCount: Math.max(0, Number(fc.unitsCount ?? 0))
              }));
            } else {
              if (groundUnits > 0) {
                floorConfigs.push({ floorNumber: 0, unitsCount: groundUnits });
              }
              for (let f = 1; f <= floors; f++) {
                floorConfigs.push({ floorNumber: f, unitsCount: unitsPerFloor });
              }
            }

            const existingInBlock = activeList.filter(u => (u.block_name || "") === bName);
            let seqInBlock = 0;

            floorConfigs.forEach((fc) => {
              for (let posInFloor = 1; posInFloor <= fc.unitsCount; posInFloor++) {
                seqInBlock++;
                if (!isNew && seqInBlock <= existingInBlock.length) {
                  continue;
                }
                globalSeq++;
                const floorNum = fc.floorNumber;
                let unitNumber = `${bName}${floorNum}${posInFloor}`;
                if (style === "block_floor_unit_short") {
                  unitNumber = bName ? `${bName}${floorNum}${posInFloor}` : `${floorNum}${posInFloor}`;
                } else if (style === "block_seq_padded") {
                  const padded = String(seqInBlock).padStart(2, "0");
                  unitNumber = bName ? `${bName}${padded}` : padded;
                } else if (style === "block_unit") {
                  const floorUnitCode = floorNum === 0 ? `0${posInFloor}` : String(floorNum * 100 + posInFloor);
                  unitNumber = bName ? `${bName}-${floorUnitCode}` : floorUnitCode;
                } else if (style === "floor_unit") {
                  unitNumber = floorNum === 0 ? `0${posInFloor}` : String(floorNum * 100 + posInFloor);
                } else if (style === "sequential") {
                  unitNumber = bName && p.blocks.length > 1 ? `${bName}-${seqInBlock}` : String(globalSeq);
                }
                const uId = "u_" + Date.now() + "_" + globalSeq + "_" + Math.floor(Math.random() * 1000);
                unitStmts.push(
                  env.DB.prepare(`
                    INSERT INTO units (id, project_id, unit_number, block_name, floor, sale_area_type, useful_area, storage_area, parking_area, common_area, area, price_per_meter, total_price, status, specific_expenses, is_deleted)
                    VALUES (?, ?, ?, ?, ?, 'useful', ?, 0, 0, 0, ?, ?, ?, 'available', '[]', 0)
                  `).bind(uId, pId, unitNumber, bName, String(floorNum), defArea, defArea, defPrice, defArea * defPrice)
                );
              }
            });
          });
        } else if (requestedUnitsCount > 0) {
          const numBlocks = Math.max(1, Number(p.numberOfBlocks) || 1);
          const blockLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];
          const startIdx = isNew ? 1 : (activeList.length + 1);
          const unitsPerBlock = Math.ceil(requestedUnitsCount / numBlocks);

          for (let i = startIdx; i <= requestedUnitsCount; i++) {
            const blockIdx = numBlocks > 1 ? Math.min(numBlocks - 1, Math.floor((i - 1) / unitsPerBlock)) : 0;
            const bName = numBlocks > 1 ? (blockLabels[blockIdx] || `بلوک ${blockIdx + 1}`) : "";
            const idxInBlock = numBlocks > 1 ? ((i - 1) % unitsPerBlock) + 1 : i;
            const floor = String(Math.ceil(idxInBlock / 2));
            const posInFloor = ((idxInBlock - 1) % 2) + 1;
            const unitNumber = p.numberingStyle === "floor_unit"
              ? String(Number(floor) * 100 + posInFloor)
              : String(i);
            const uId = "u_" + Date.now() + "_" + i + "_" + Math.floor(Math.random() * 100);
            unitStmts.push(
              env.DB.prepare(`
                INSERT INTO units (id, project_id, unit_number, block_name, floor, sale_area_type, useful_area, storage_area, parking_area, common_area, area, price_per_meter, total_price, status, specific_expenses, is_deleted)
                VALUES (?, ?, ?, ?, ?, 'useful', ?, 0, 0, 0, ?, ?, ?, 'available', '[]', 0)
              `).bind(uId, pId, unitNumber, bName, floor, defArea, defArea, defPrice, defArea * defPrice)
            );
          }
        }

        if (unitStmts.length > 0) {
          await env.DB.batch(unitStmts);
        }

        return new Response(JSON.stringify({ status: "success", id: pId, project: { ...p, id: pId, numberOfUnits: requestedUnitsCount } }), { headers: corsHeaders });
      }

      // 5. Create or Update Account
      if (path === "/api/accounts" && method === "POST") {
        await ensureDatabaseSchema(env);
        const acc = await request.json();
        const accId = acc.id || "a_" + Date.now();
        const nature = acc.nature || (acc.type === "investor" ? "creditor" : "debtor");

        await env.DB.prepare(`
          INSERT INTO accounts (id, name, type, type_name, account_number, bank_name, balance, code, level, parent_code, nature, project_id, extra_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            type=excluded.type,
            type_name=excluded.type_name,
            account_number=excluded.account_number,
            bank_name=excluded.bank_name,
            balance=excluded.balance,
            code=COALESCE(excluded.code, accounts.code),
            level=COALESCE(excluded.level, accounts.level),
            parent_code=COALESCE(excluded.parent_code, accounts.parent_code),
            nature=COALESCE(excluded.nature, accounts.nature),
            project_id=COALESCE(excluded.project_id, accounts.project_id),
            extra_json=excluded.extra_json
        `).bind(
          accId,
          acc.name,
          acc.type,
          acc.typeName || "حساب",
          acc.accountNumber || null,
          acc.bankName || null,
          Number(acc.balance || 0),
          acc.code || null,
          acc.level !== undefined ? Number(acc.level) : 3,
          acc.parentCode || null,
          nature,
          acc.projectId || null,
          JSON.stringify(acc)
        ).run();

        return new Response(JSON.stringify({ status: "success", id: accId, account: { ...acc, id: accId } }), { headers: corsHeaders });
      }

      // 6. Record Financial Transaction (Receipts & Payments)
      if (path === "/api/transactions" && method === "POST") {
        await ensureDatabaseSchema(env);
        const tx = await request.json();
        const txId = tx.id || "t_" + Date.now();
        const defaultAccId = await getFirstAccountId(env, "a1");
        const resolvedAccountId = tx.accountId || defaultAccId;

        const isNonCashVal = tx.isNonCash ? 1 : 0;
        const barterPropType = tx.barterDetails ? tx.barterDetails.propertyType : null;
        const barterDesc = tx.barterDetails ? tx.barterDetails.description : null;
        const barterValue = tx.barterDetails ? Number(tx.barterDetails.agreedValue || 0) : null;

        let attachmentUrl = tx.attachmentData || null;
        if (tx.attachmentData && tx.attachmentData.startsWith("data:")) {
          try {
            const b2Url = await uploadBase64ToB2(tx.attachmentData, tx.attachmentName || "file", env, request.headers);
            if (b2Url) {
              attachmentUrl = b2Url;
            }
          } catch (b2Err) {
            return new Response(JSON.stringify({ 
              status: "error", 
              message: "خطا در آپلود فاکتور در فضای ابری Backblaze B2: " + b2Err.message 
            }), { status: 500, headers: corsHeaders });
          }
        }

        const amountVal = Number(tx.amount || 0);
        let paymentStatus = tx.paymentStatus || "paid";
        let payments = (tx.payments || []).map((p, idx) => ({
          ...p,
          rowNumber: p.rowNumber !== undefined ? p.rowNumber : (idx + 1),
          accountId: p.accountId || resolvedAccountId,
          invoiceNumber: p.invoiceNumber || tx.invoiceNumber || "",
          invoiceDescription: p.invoiceDescription || p.description || tx.description || ""
        }));

        if (tx.type === "expense" && !tx.isNonCash) {
          if (payments.length > 0) {
            const sumPay = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
            paymentStatus = sumPay >= amountVal ? "paid" : (sumPay > 0 ? "partially_paid" : "unpaid");
          } else if (paymentStatus === "paid") {
            payments = [{
              id: "p_" + Date.now(),
              rowNumber: 1,
              amount: amountVal,
              date: tx.date || getTodayShamsiWorker(),
              accountId: resolvedAccountId,
              referenceNumber: tx.referenceNumber || "تسویه نقدی فوری",
              invoiceNumber: tx.invoiceNumber || "",
              invoiceDescription: tx.description || "ثبت همزمان با فاکتور"
            }];
          }
        } else if (tx.type === "income" && !tx.isNonCash && payments.length === 0) {
          payments = [{
            id: "p_" + Date.now(),
            rowNumber: 1,
            amount: amountVal,
            date: tx.date || getTodayShamsiWorker(),
            accountId: resolvedAccountId,
            referenceNumber: tx.referenceNumber || "واریزی دریافتی",
            invoiceNumber: tx.invoiceNumber || "",
            invoiceDescription: tx.description || "سند دریافت وجه"
          }];
        }

        const paidAmt = tx.isNonCash ? amountVal : payments.reduce((s, p) => s + Number(p.amount || 0), 0);
        const approvalStatus = tx.approvalStatus || "approved";
        const approvedAmount = tx.approvedAmount !== undefined ? Number(tx.approvedAmount) : null;
        const approvedBy = tx.approvedBy || null;
        const approvedDate = tx.approvedDate || null;

        await env.DB.prepare(`
          INSERT INTO transactions (id, company_id, project_id, type, category, sub_category, amount, account_id, person_name, date, description, invoice_number, is_non_cash, barter_property_type, barter_description, barter_agreed_value, attachment_name, attachment_data, approval_status, approved_amount, approved_by, approved_date, pre_sale_id, contact_id, payment_status, payments_json, extra_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            amount=excluded.amount,
            description=excluded.description,
            invoice_number=excluded.invoice_number,
            payment_status=excluded.payment_status,
            payments_json=excluded.payments_json,
            extra_json=excluded.extra_json
        `).bind(
          txId,
          tx.companyId || "c1",
          tx.projectId,
          tx.type,
          tx.category,
          tx.subCategory || null,
          amountVal,
          resolvedAccountId,
          tx.personName || "طرف حساب عمومی",
          tx.date || getTodayShamsiWorker(),
          tx.description || "",
          tx.invoiceNumber || "",
          isNonCashVal,
          barterPropType,
          barterDesc,
          barterValue,
          tx.attachmentName || null,
          attachmentUrl,
          approvalStatus,
          approvedAmount,
          approvedBy,
          approvedDate,
          tx.preSaleId || null,
          tx.contactId || null,
          paymentStatus,
          JSON.stringify(payments),
          JSON.stringify({ ...tx, id: txId, accountId: resolvedAccountId, paymentStatus, payments })
        ).run();

        // Adjust account balances in D1 based on actual paid amounts
        if (!tx.isNonCash) {
          for (const p of payments) {
            const pAcc = p.accountId || resolvedAccountId;
            const pAmt = Number(p.amount || 0);
            if (pAcc && pAmt > 0) {
              const diff = tx.type === "expense" ? -pAmt : pAmt;
              await env.DB.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(diff, pAcc).run();
            }
          }
        }

        // Update contact balance for unpaid/credit expenses or pre-buyer income
        if (tx.personName) {
          const contact = await env.DB.prepare("SELECT * FROM contacts WHERE TRIM(name) = ?").bind(String(tx.personName).trim()).first();
          if (contact) {
            if (tx.type === "expense" && !tx.isNonCash) {
              const unpaidAmt = Math.max(0, amountVal - paidAmt);
              if (unpaidAmt > 0) {
                await env.DB.prepare("UPDATE contacts SET balance = COALESCE(balance, 0) + ? WHERE id = ?").bind(unpaidAmt, contact.id).run();
              }
            } else if (tx.type === "income" && contact.role === "pre_buyer") {
              await env.DB.prepare("UPDATE contacts SET balance = MAX(0, COALESCE(balance, 0) - ?) WHERE id = ?").bind(amountVal, contact.id).run();
            }
          }
        }

        return new Response(JSON.stringify({ status: "success", id: txId, attachmentUrl, transaction: { ...tx, id: txId, accountId: resolvedAccountId, paymentStatus, payments } }), { headers: corsHeaders });
      }

      // 6b. Add installment / payment to existing transaction
      if (path === "/api/transactions/pay" && method === "POST") {
        await ensureDatabaseSchema(env);
        const body = await request.json();
        const { transactionId, rowNumber, amount, date, accountId, referenceNumber, invoiceNumber, invoiceDescription, description, settlementMethod, paymentStatus, destinationAccount, receiptFileName, receiptFileData } = body;

        const txRow = await env.DB.prepare("SELECT * FROM transactions WHERE id = ?").bind(transactionId).first();
        if (!txRow) {
          return new Response(JSON.stringify({ status: "error", message: "تراکنش یافت نشد" }), { status: 404, headers: corsHeaders });
        }

        let payments = [];
        try { payments = txRow.payments_json ? JSON.parse(txRow.payments_json) : []; } catch { payments = []; }

        const payNum = Number(amount || 0);
        const defaultAccId = await getFirstAccountId(env, "a1");
        const resolvedAccId = accountId || txRow.account_id || defaultAccId;
        const newPayment = {
          id: "p_" + Date.now(),
          rowNumber: rowNumber !== undefined ? (Number(rowNumber) || rowNumber) : (payments.length + 1),
          amount: payNum,
          date: date || getTodayShamsiWorker(),
          accountId: resolvedAccId,
          referenceNumber: referenceNumber || "",
          invoiceNumber: invoiceNumber !== undefined ? invoiceNumber : (txRow.invoice_number || ""),
          invoiceDescription: invoiceDescription !== undefined ? invoiceDescription : (description || txRow.description || ""),
          settlementMethod: settlementMethod || "فیش بانکی",
          paymentStatus: paymentStatus || "موفق",
          destinationAccount: destinationAccount || "",
          receiptFileName: receiptFileName || "",
          receiptFileData: receiptFileData || "",
          description: description || invoiceDescription || ""
        };
        payments.push(newPayment);

        const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
        const txAmount = Number(txRow.amount || 0);
        const nextStatus = totalPaid >= txAmount ? "paid" : (totalPaid > 0 ? "partially_paid" : "unpaid");

        await env.DB.prepare("UPDATE transactions SET payment_status = ?, payments_json = ? WHERE id = ?")
          .bind(nextStatus, JSON.stringify(payments), transactionId).run();

        if (resolvedAccId && payNum > 0) {
          const diff = txRow.type === "income" ? payNum : -payNum;
          await env.DB.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(diff, resolvedAccId).run();
        }

        if (txRow.person_name && txRow.type === "expense") {
          const contact = await env.DB.prepare("SELECT * FROM contacts WHERE TRIM(name) = ?").bind(String(txRow.person_name).trim()).first();
          if (contact) {
            await env.DB.prepare("UPDATE contacts SET balance = MAX(0, COALESCE(balance, 0) - ?) WHERE id = ?").bind(payNum, contact.id).run();
          }
        }

        return new Response(JSON.stringify({ status: "success", payment: newPayment, paymentStatus: nextStatus }), { headers: corsHeaders });
      }

      // 7. Define Materials / Record Warehouse Transactions
      if (path === "/api/materials" && method === "POST") {
        await ensureDatabaseSchema(env);
        const body = await request.json();
        const isTx = !!body.projectId && (body.type === "in" || body.type === "out");

        if (isTx) {
          const mTxId = body.id || "mt_" + Date.now();
          await env.DB.prepare(`
            INSERT INTO material_transactions (id, project_id, material_id, type, quantity, unit_price, date, person_name, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            mTxId,
            body.projectId,
            body.materialId,
            body.type,
            Number(body.quantity || 0),
            Number(body.unitPrice || 0),
            body.date || getTodayShamsiWorker(),
            body.personName || "انباردار",
            body.description || ""
          ).run();

          const { results } = await env.DB.prepare("SELECT stock, average_price FROM materials WHERE id = ?").bind(body.materialId).all();
          if (results && results.length > 0) {
            let stock = Number(results[0].stock || 0);
            let avgPrice = Number(results[0].average_price || 0);
            const q = Number(body.quantity || 0);
            const p = Number(body.unitPrice || 0);

            if (body.type === "in") {
              const totalValue = (stock * avgPrice) + (q * p);
              stock += q;
              avgPrice = stock > 0 ? Math.round(totalValue / stock) : avgPrice;
            } else {
              stock = Math.max(0, stock - q);
            }

            await env.DB.prepare("UPDATE materials SET stock = ?, average_price = ? WHERE id = ?").bind(stock, avgPrice, body.materialId).run();
          }

          return new Response(JSON.stringify({ status: "success", id: mTxId }), { headers: corsHeaders });
        } else {
          const mId = body.id || "m_" + Date.now();
          await env.DB.prepare(`
            INSERT INTO materials (id, name, category, unit, stock, average_price, code, sub_category, secondary_unit, conversion_factor, consumption_type, min_stock, purchase_price, project_id, extra_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name=excluded.name,
              category=excluded.category,
              unit=excluded.unit,
              stock=excluded.stock,
              average_price=excluded.average_price,
              code=excluded.code,
              sub_category=excluded.sub_category,
              secondary_unit=excluded.secondary_unit,
              conversion_factor=excluded.conversion_factor,
              consumption_type=excluded.consumption_type,
              min_stock=excluded.min_stock,
              purchase_price=excluded.purchase_price,
              project_id=excluded.project_id,
              extra_json=excluded.extra_json
          `).bind(
            mId,
            body.name,
            body.category || "عمومی",
            body.unit || "عدد",
            Number(body.stock || 0),
            Number(body.averagePrice || 0),
            body.code || null,
            body.subCategory || null,
            body.secondaryUnit || null,
            body.conversionFactor ? Number(body.conversionFactor) : null,
            body.consumptionType || null,
            body.minStock ? Number(body.minStock) : null,
            body.purchasePrice ? Number(body.purchasePrice) : null,
            body.projectId || null,
            JSON.stringify(body)
          ).run();

          return new Response(JSON.stringify({ status: "success", id: mId, material: { ...body, id: mId } }), { headers: corsHeaders });
        }
      }

      // 8. Add/Update Check
      if (path === "/api/checks" && method === "POST") {
        await ensureDatabaseSchema(env);
        const chk = await request.json();
        
        if (chk.id && chk.status) {
          const { results } = await env.DB.prepare("SELECT * FROM checks WHERE id = ?").bind(chk.id).all();
          if (results && results.length > 0) {
            const oldStatus = results[0].status;
            const check = results[0];

            await env.DB.prepare("UPDATE checks SET status = ? WHERE id = ?").bind(chk.status, chk.id).run();

            if (oldStatus !== "passed" && chk.status === "passed") {
              const txId = "t_ch_" + Date.now();
              const type = check.type === "outgoing" ? "expense" : "income";
              const category = "پاس شدن چک";
              const amount = Number(check.amount || 0);
              const defaultAccId = await getFirstAccountId(env, "a1");
              const accId = chk.accountId || defaultAccId;

              await env.DB.prepare(`
                INSERT INTO transactions (id, company_id, project_id, type, category, amount, account_id, person_name, date, description, is_non_cash, payment_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'paid')
              `).bind(
                txId,
                check.company_id,
                check.project_id,
                type,
                category,
                amount,
                accId,
                check.person_name,
                chk.clearanceDate || check.due_date,
                `وصول خودکار چک شماره ${check.check_number} عهده بانک ${check.bank_name}`
              ).run();

              const diff = type === "expense" ? -amount : amount;
              await env.DB.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(diff, accId).run();
            }
          }
          return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
        } else {
          const chkId = "chk_" + Date.now();
          await env.DB.prepare(`
            INSERT INTO checks (id, company_id, project_id, check_number, bank_name, due_date, amount, type, status, person_name, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            chkId,
            chk.companyId || "c1",
            chk.projectId,
            chk.checkNumber,
            chk.bankName,
            chk.dueDate,
            Number(chk.amount || 0),
            chk.type,
            chk.status || "pending",
            chk.personName,
            chk.description || ""
          ).run();

          return new Response(JSON.stringify({ status: "success", id: chkId }), { headers: corsHeaders });
        }
      }

      // 9. Update Unit Details / Record specific unit expenses / Create New Unit
      if (path === "/api/units" && method === "POST") {
        await ensureDatabaseSchema(env);
        const body = await request.json();
        const unitId = body.id;

        const { results } = unitId ? await env.DB.prepare("SELECT * FROM units WHERE id = ?").bind(unitId).all() : { results: [] };
        if (results && results.length > 0) {
          const currentUnit = results[0];
          let currentExpenses = currentUnit.specific_expenses ? JSON.parse(currentUnit.specific_expenses) : [];

          if (body.addExpense || body.expenseTitle) {
            const rawExp = body.addExpense || {
              title: body.expenseTitle,
              amount: body.expenseAmount,
              date: body.date,
              accountId: body.accountId
            };
            const newExp = {
              id: "ue_" + Date.now(),
              title: rawExp.title,
              amount: Number(rawExp.amount || 0),
              date: rawExp.date || getTodayShamsiWorker()
            };
            currentExpenses.push(newExp);

            await env.DB.prepare("UPDATE units SET specific_expenses = ? WHERE id = ?")
              .bind(JSON.stringify(currentExpenses), unitId)
              .run();

            const defaultAccId = await getFirstAccountId(env, "a2");
            const accId = rawExp.accountId || defaultAccId;
            await env.DB.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?")
              .bind(newExp.amount, accId)
              .run();

            const txId = "t_unit_exp_" + Date.now();
            await env.DB.prepare(`
              INSERT INTO transactions (id, company_id, project_id, type, category, amount, account_id, person_name, date, description, is_non_cash, payment_status)
              VALUES (?, 'c1', ?, 'expense', ?, ?, ?, ?, ?, ?, 0, 'paid')
            `).bind(
              txId,
              currentUnit.project_id,
              "هزینه اختصاصی واحد " + currentUnit.unit_number,
              newExp.amount,
              accId,
              currentUnit.buyer_name || "کارفرما",
              newExp.date,
              `هزینه ساخت سفارشی برای واحد ${currentUnit.unit_number}: ${newExp.title}`
            ).run();

            return new Response(JSON.stringify({ status: "success", expense: newExp }), { headers: corsHeaders });
          } else {
            const saleAreaType = body.saleAreaType !== undefined ? body.saleAreaType : (currentUnit.sale_area_type || "useful");
            const usefulArea = body.usefulArea !== undefined ? Number(body.usefulArea) : Number(currentUnit.useful_area ?? currentUnit.area ?? 0);
            const storageArea = body.storageArea !== undefined ? Number(body.storageArea) : Number(currentUnit.storage_area ?? 0);
            const parkingArea = body.parkingArea !== undefined ? Number(body.parkingArea) : Number(currentUnit.parking_area ?? 0);
            const commonArea = saleAreaType === "with_commons"
              ? (body.commonArea !== undefined ? Number(body.commonArea) : Number(currentUnit.common_area ?? 0))
              : 0;
            const hasBreakdown = body.usefulArea !== undefined || body.storageArea !== undefined || body.parkingArea !== undefined || body.commonArea !== undefined || body.saleAreaType !== undefined;
            const breakdownSum = Number((usefulArea + storageArea + parkingArea + commonArea).toFixed(2));
            const newArea = body.area !== undefined ? Number(body.area) : (hasBreakdown ? breakdownSum : Number(currentUnit.area || 0));
            const newPricePerMeter = body.pricePerMeter !== undefined ? Number(body.pricePerMeter) : Number(currentUnit.price_per_meter || 0);
            const newTotalPrice = Math.round(newArea * newPricePerMeter);

            await env.DB.prepare(`
              UPDATE units SET
                unit_number = ?,
                block_name = ?,
                floor = ?,
                sale_area_type = ?,
                useful_area = ?,
                storage_area = ?,
                parking_area = ?,
                common_area = ?,
                area = ?,
                price_per_meter = ?,
                total_price = ?,
                status = ?,
                buyer_name = ?,
                down_payment = ?,
                barter_property = ?
              WHERE id = ?
            `).bind(
              body.unitNumber !== undefined ? String(body.unitNumber) : currentUnit.unit_number,
              body.blockName !== undefined ? String(body.blockName) : (currentUnit.block_name || ""),
              body.floor !== undefined ? String(body.floor) : currentUnit.floor,
              saleAreaType,
              usefulArea,
              storageArea,
              parkingArea,
              commonArea,
              newArea,
              newPricePerMeter,
              newTotalPrice,
              body.status || currentUnit.status,
              body.buyerName !== undefined ? body.buyerName : currentUnit.buyer_name,
              body.downPayment !== undefined ? Number(body.downPayment || 0) : currentUnit.down_payment,
              body.barterProperty !== undefined ? body.barterProperty : currentUnit.barter_property,
              unitId
            ).run();

            return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
          }
        } else {
          const saleAreaType = body.saleAreaType || "useful";
          const usefulArea = Number(body.usefulArea ?? body.area ?? 0);
          const storageArea = Number(body.storageArea || 0);
          const parkingArea = Number(body.parkingArea || 0);
          const commonArea = saleAreaType === "with_commons" ? Number(body.commonArea || 0) : 0;
          const areaVal = body.area !== undefined ? Number(body.area) : Number((usefulArea + storageArea + parkingArea + commonArea).toFixed(2));
          const ppmVal = Number(body.pricePerMeter || 0);
          const newId = "u_" + (body.projectId || "p1") + "_" + (body.unitNumber || Date.now());

          await env.DB.prepare(`
            INSERT INTO units (id, project_id, unit_number, block_name, floor, sale_area_type, useful_area, storage_area, parking_area, common_area, area, price_per_meter, total_price, status, buyer_name, down_payment, barter_property, specific_expenses)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')
          `).bind(
            newId,
            body.projectId || "p1",
            body.unitNumber || "واحد جدید",
            body.blockName || "",
            body.floor || "اول",
            saleAreaType,
            usefulArea,
            storageArea,
            parkingArea,
            commonArea,
            areaVal,
            ppmVal,
            Math.round(areaVal * ppmVal),
            body.status || "available",
            body.buyerName || null,
            Number(body.downPayment || 0),
            body.barterProperty || null
          ).run();

          return new Response(JSON.stringify({ status: "success", id: newId }), { headers: corsHeaders });
        }
      }

      // 9b. Add or Update Contact
      if (path === "/api/contacts" && method === "POST") {
        await ensureDatabaseSchema(env);
        const c = await request.json();
        const id = c.id || "co_" + Date.now();
        const todayShamsi = getTodayShamsiWorker();
        await env.DB.prepare(`
          INSERT INTO contacts (id, name, phone, role, role_name, roles_json, national_id, bank_card_number, bank_name, bank_iban, job_category, payment_method, barter_units_json, balance, created_at, project_id, extra_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            phone = excluded.phone,
            role = excluded.role,
            role_name = excluded.role_name,
            roles_json = excluded.roles_json,
            national_id = excluded.national_id,
            bank_card_number = excluded.bank_card_number,
            bank_name = excluded.bank_name,
            bank_iban = excluded.bank_iban,
            job_category = excluded.job_category,
            payment_method = excluded.payment_method,
            barter_units_json = excluded.barter_units_json,
            balance = excluded.balance,
            project_id = excluded.project_id,
            extra_json = excluded.extra_json
        `).bind(
          id,
          c.name,
          c.phone || "",
          c.role || "pre_buyer",
          c.roleName || null,
          c.roles ? JSON.stringify(c.roles) : null,
          c.nationalId || null,
          c.bankCardNumber || null,
          c.bankName || null,
          c.bankIBAN || null,
          c.jobCategory || null,
          c.paymentMethod || "cash",
          c.barterUnits ? JSON.stringify(c.barterUnits) : null,
          Number(c.balance || 0),
          c.createdAt || todayShamsi,
          c.projectId || null,
          JSON.stringify({ ...c, id })
        ).run();

        // Sync barter units with units & pre_sales tables
        if (c.paymentMethod === "barter" && Array.isArray(c.barterUnits)) {
          for (const bu of c.barterUnits) {
            const saleAreaType = bu.saleAreaType || "useful";
            const usefulArea = Number(bu.usefulArea ?? bu.area ?? 0);
            const storageArea = Number(bu.storageArea || 0);
            const parkingArea = Number(bu.parkingArea || 0);
            const commonArea = saleAreaType === "with_commons" ? Number(bu.commonArea || 0) : 0;
            const totalArea = Number(bu.area || (usefulArea + storageArea + parkingArea + commonArea) || 0);
            const pricePerMeter = Number(bu.price || 0);
            const totalP = Math.round(totalArea * pricePerMeter);

            if (bu.unitId) {
              await env.DB.prepare(`
                UPDATE units SET
                  status = 'bartered',
                  buyer_name = ?,
                  contact_id = ?,
                  block_name = COALESCE(?, block_name),
                  sale_area_type = ?,
                  useful_area = ?,
                  storage_area = ?,
                  parking_area = ?,
                  common_area = ?,
                  area = ?,
                  price_per_meter = ?,
                  total_price = ?
                WHERE id = ?
              `).bind(c.name, id, bu.blockName || null, saleAreaType, usefulArea, storageArea, parkingArea, commonArea, totalArea, pricePerMeter, totalP, bu.unitId).run();
            }
          }
        }

        return new Response(JSON.stringify({ status: "success", contact: { id, ...c } }), { headers: corsHeaders });
      }

      // 9c. Add or Update Imprest Fund
      if (path === "/api/imprests" && method === "POST") {
        await ensureDatabaseSchema(env);
        const f = await request.json();
        const id = f.id || "im_" + Date.now();
        const todayShamsi = getTodayShamsiWorker();
        await env.DB.prepare(`
          INSERT INTO imprest_funds (id, project_id, contact_id, allocated_limit, balance, status, last_reconciliation_date, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            allocated_limit = excluded.allocated_limit,
            balance = excluded.balance,
            status = excluded.status,
            last_reconciliation_date = excluded.last_reconciliation_date
        `).bind(
          id,
          f.projectId,
          f.contactId,
          Number(f.allocatedLimit || 0),
          Number(f.balance !== undefined ? f.balance : (f.allocatedLimit || 0)),
          f.status || "active",
          f.lastReconciliationDate || todayShamsi,
          f.createdAt || todayShamsi
        ).run();

        return new Response(JSON.stringify({ status: "success", imprestFund: { id, ...f } }), { headers: corsHeaders });
      }

      // 9d. Record Imprest Expense
      if (path === "/api/imprests/expenses" && method === "POST") {
        await ensureDatabaseSchema(env);
        const exp = await request.json();
        const id = exp.id || "ie_" + Date.now();
        const todayShamsi = getTodayShamsiWorker();

        const fund = await env.DB.prepare("SELECT * FROM imprest_funds WHERE id = ?").bind(exp.imprestId).first();
        if (!fund) {
          return new Response(JSON.stringify({ error: "تنخواه‌گردان یافت نشد" }), { status: 404, headers: corsHeaders });
        }
        if (fund.status === "locked") {
          return new Response(JSON.stringify({ error: "تنخواه‌گردان به علت عدم تسویه حساب یا سقف بدهی قفل شده است" }), { status: 400, headers: corsHeaders });
        }

        const expAmount = Number(exp.amount || 0);
        const paymentStatus = exp.paymentStatus || "paid";
        const paidAmount = paymentStatus === "paid" ? expAmount : (paymentStatus === "partially_paid" ? Number(exp.paidAmount || 0) : 0);

        const payments = paidAmount > 0 ? [{
          id: "p_" + Date.now(),
          rowNumber: 1,
          amount: paidAmount,
          date: exp.expenseDate || todayShamsi,
          accountId: "a3",
          referenceNumber: exp.referenceNumber || "تسویه تنخواه",
          invoiceNumber: exp.invoiceNumber || "",
          invoiceDescription: exp.description || ""
        }] : [];

        await env.DB.prepare(`
          INSERT INTO imprest_expenses (id, imprest_id, expense_date, amount, invoice_number, description, material_category, attachment_url, status, created_at, contact_id, person_name, stage, payment_status, attachment_name, attachment_data, payments_json, extra_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          exp.imprestId,
          exp.expenseDate || todayShamsi,
          expAmount,
          exp.invoiceNumber || "",
          exp.description || "",
          exp.materialCategory || "سایر",
          exp.attachmentUrl || null,
          exp.status || "approved",
          todayShamsi,
          exp.contactId || null,
          exp.personName || null,
          exp.stage || null,
          paymentStatus,
          exp.attachmentName || null,
          exp.attachmentData || null,
          JSON.stringify(payments),
          JSON.stringify({ ...exp, id, paymentStatus, payments })
        ).run();

        if (paidAmount > 0) {
          const newBalance = Math.max(0, Number(fund.balance || 0) - paidAmount);
          await env.DB.prepare("UPDATE imprest_funds SET balance = ? WHERE id = ?").bind(newBalance, exp.imprestId).run();
        }

        const remainingUnpaid = Math.max(0, expAmount - paidAmount);
        if (remainingUnpaid > 0 && exp.contactId) {
          await env.DB.prepare("UPDATE contacts SET balance = COALESCE(balance, 0) + ? WHERE id = ?").bind(remainingUnpaid, exp.contactId).run();
        }

        const contact = await env.DB.prepare("SELECT * FROM contacts WHERE id = ?").bind(fund.contact_id).first();
        const txId = "t_im_exp_" + id;
        await env.DB.prepare(`
          INSERT INTO transactions (id, company_id, project_id, type, category, sub_category, amount, account_id, person_name, date, description, invoice_number, is_non_cash, attachment_name, payment_status, payments_json)
          VALUES (?, 'c1', ?, 'expense', 'هزینه تنخواه', ?, ?, 'a3', ?, ?, ?, ?, 0, ?, ?, ?)
        `).bind(
          txId,
          fund.project_id,
          exp.materialCategory || "سایر",
          expAmount,
          exp.personName || (contact ? contact.name : "تنخواه‌دار"),
          exp.expenseDate || todayShamsi,
          `[هزینه تنخواه‌گردان] ${exp.description}`,
          exp.invoiceNumber || "",
          exp.attachmentName || null,
          paymentStatus,
          JSON.stringify(payments)
        ).run();

        if (paidAmount > 0) {
          await env.DB.prepare("UPDATE accounts SET balance = balance - ? WHERE id = 'a3'").bind(paidAmount).run();
        }

        return new Response(JSON.stringify({ status: "success", id }), { headers: corsHeaders });
      }

      // 9d-2. Add installment / payment to existing Imprest Expense
      if (path === "/api/imprests/expenses/pay" && method === "POST") {
        await ensureDatabaseSchema(env);
        const body = await request.json();
        const { expenseId, rowNumber, amount, date, referenceNumber, invoiceNumber, invoiceDescription, description } = body;
        const expRow = await env.DB.prepare("SELECT * FROM imprest_expenses WHERE id = ?").bind(expenseId).first();
        if (!expRow) {
          return new Response(JSON.stringify({ error: "فاکتور تنخواه یافت نشد" }), { status: 404, headers: corsHeaders });
        }
        const fund = await env.DB.prepare("SELECT * FROM imprest_funds WHERE id = ?").bind(expRow.imprest_id).first();
        if (!fund) {
          return new Response(JSON.stringify({ error: "تنخواه‌گردان مربوطه یافت نشد" }), { status: 404, headers: corsHeaders });
        }
        const payVal = Number(amount || 0);
        let payments = [];
        try { payments = expRow.payments_json ? JSON.parse(expRow.payments_json) : []; } catch { payments = []; }
        const newPayment = {
          id: "p_" + Date.now(),
          rowNumber: rowNumber !== undefined ? (Number(rowNumber) || rowNumber) : (payments.length + 1),
          amount: payVal,
          date: date || expRow.expense_date,
          accountId: "a3",
          referenceNumber: referenceNumber || "",
          invoiceNumber: invoiceNumber !== undefined ? invoiceNumber : (expRow.invoice_number || ""),
          invoiceDescription: invoiceDescription !== undefined ? invoiceDescription : (description || expRow.description || ""),
          description: description || invoiceDescription || ""
        };
        payments.push(newPayment);
        const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
        const nextStatus = totalPaid >= Number(expRow.amount || 0) ? "paid" : "partially_paid";

        await env.DB.prepare("UPDATE imprest_expenses SET payment_status = ?, payments_json = ? WHERE id = ?")
          .bind(nextStatus, JSON.stringify(payments), expenseId).run();
        await env.DB.prepare("UPDATE imprest_funds SET balance = MAX(0, COALESCE(balance, 0) - ?) WHERE id = ?")
          .bind(payVal, fund.id).run();
        if (expRow.contact_id) {
          await env.DB.prepare("UPDATE contacts SET balance = MAX(0, COALESCE(balance, 0) - ?) WHERE id = ?")
            .bind(payVal, expRow.contact_id).run();
        }
        await env.DB.prepare("UPDATE transactions SET payment_status = ?, payments_json = ? WHERE id = ?")
          .bind(nextStatus, JSON.stringify(payments), "t_im_exp_" + expenseId).run();

        return new Response(JSON.stringify({ status: "success", payment: newPayment }), { headers: corsHeaders });
      }

      // 9e. Create Pre-Sale Contract
      if (path === "/api/presales" && method === "POST") {
        await ensureDatabaseSchema(env);
        const presale = await request.json();
        const id = "ps_" + Date.now();
        const contractDate = presale.contractDate || getTodayShamsiWorker();
        const saleAreaType = presale.saleAreaType || "useful";
        const usefulArea = Number(presale.usefulArea ?? presale.contractArea ?? 0);
        const storageArea = Number(presale.storageArea || 0);
        const parkingArea = Number(presale.parkingArea || 0);
        const commonArea = saleAreaType === "with_commons" ? Number(presale.commonArea || 0) : 0;
        const computedArea = Number(presale.contractArea || (usefulArea + storageArea + parkingArea + commonArea) || 0);
        const pricePerMeter = Number(presale.pricePerMeter || 0);
        const totalPrice = Math.round(Number(presale.totalPrice || (computedArea * pricePerMeter)));
        const downPayment = Math.round(totalPrice * 0.30);

        await env.DB.prepare(`
          INSERT INTO pre_sales (id, project_id, contact_id, unit_id, block_name, sale_area_type, useful_area, storage_area, parking_area, common_area, contract_area, price_per_meter, total_price, contract_date, status, extra_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        `).bind(
          id,
          presale.projectId,
          presale.contactId,
          presale.unitId,
          presale.blockName || "",
          saleAreaType,
          usefulArea,
          storageArea,
          parkingArea,
          commonArea,
          computedArea,
          pricePerMeter,
          totalPrice,
          contractDate,
          JSON.stringify({ ...presale, id, contractArea: computedArea, totalPrice })
        ).run();

        const buyer = await env.DB.prepare("SELECT * FROM contacts WHERE id = ?").bind(presale.contactId).first();
        const buyerName = buyer ? buyer.name : "پیش‌خریدار";

        await env.DB.prepare(`
          UPDATE units SET
            status = 'pre_sold',
            buyer_name = ?,
            contact_id = ?,
            contract_id = ?,
            block_name = COALESCE(?, block_name),
            sale_area_type = ?,
            useful_area = ?,
            storage_area = ?,
            parking_area = ?,
            common_area = ?,
            area = ?,
            price_per_meter = ?,
            total_price = ?,
            down_payment = ?
          WHERE id = ?
        `).bind(buyerName, presale.contactId, id, presale.blockName || null, saleAreaType, usefulArea, storageArea, parkingArea, commonArea, computedArea, pricePerMeter, totalPrice, downPayment, presale.unitId).run();

        const currentMs = Date.now();
        const inst1 = downPayment;
        const inst2 = Math.round(totalPrice * 0.10);
        const inst3 = Math.round(totalPrice * 0.15);
        const inst4 = Math.round(totalPrice * 0.15);
        const inst5 = Math.round(totalPrice * 0.10);
        const inst6 = Math.round(totalPrice * 0.10);
        const inst7 = Math.max(0, totalPrice - (inst1 + inst2 + inst3 + inst4 + inst5 + inst6));

        const installments = [
          { name: "پیش‌پرداخت (عقد قرارداد)", dueDate: contractDate, amount: inst1, isPaid: 1, paidDate: contractDate },
          { name: "پایان پی‌ریزی و فونداسیون", dueDate: addShamsiMonthsWorker(contractDate, 2), amount: inst2, isPaid: 0, paidDate: null },
          { name: "پایان اسکلت و سازه", dueDate: addShamsiMonthsWorker(contractDate, 5), amount: inst3, isPaid: 0, paidDate: null },
          { name: "پایان سفت‌کاری و دیوارچینی", dueDate: addShamsiMonthsWorker(contractDate, 8), amount: inst4, isPaid: 0, paidDate: null },
          { name: "پایان نازک‌کاری و نصبیات", dueDate: addShamsiMonthsWorker(contractDate, 11), amount: inst5, isPaid: 0, paidDate: null },
          { name: "تحویل فیزیکی واحد مسکونی", dueDate: addShamsiMonthsWorker(contractDate, 13), amount: inst6, isPaid: 0, paidDate: null },
          { name: "تنظیم سند رسمی انتقال در دفترخانه", dueDate: addShamsiMonthsWorker(contractDate, 15), amount: inst7, isPaid: 0, paidDate: null }
        ];

        for (let i = 0; i < installments.length; i++) {
          const inst = installments[i];
          const instId = `psi_${i + 1}_${currentMs}`;
          await env.DB.prepare(`
            INSERT INTO pre_sale_installments (id, pre_sale_id, installment_name, due_date, amount, is_paid, paid_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(instId, id, inst.name, inst.dueDate, inst.amount, inst.isPaid, inst.paidDate).run();
        }

        const defaultAccId = await getFirstAccountId(env, "a1");
        const downAccountId = presale.accountId || defaultAccId;
        const txId = "t_ps_down_" + currentMs;
        await env.DB.prepare(`
          INSERT INTO transactions (id, company_id, project_id, type, category, amount, account_id, person_name, date, description, is_non_cash, pre_sale_id, contact_id, payment_status)
          VALUES (?, 'c1', ?, 'income', 'پیش‌فروش', ?, ?, ?, ?, 'پیش‌دریافت پیش‌پرداخت قرارداد پیش‌فروش واحد', 0, ?, ?, 'paid')
        `).bind(txId, presale.projectId, downPayment, downAccountId, buyerName, contractDate, id, presale.contactId).run();

        await env.DB.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(downPayment, downAccountId).run();

        if (buyer) {
          const newBuyerBalance = (Number(buyer.balance || 0) + totalPrice) - downPayment;
          await env.DB.prepare("UPDATE contacts SET balance = ? WHERE id = ?").bind(newBuyerBalance, presale.contactId).run();
        }

        return new Response(JSON.stringify({ status: "success", id }), { headers: corsHeaders });
      }

      // 9f. Pay Pre-Sale Installment
      if (path === "/api/presales/installments/pay" && method === "POST") {
        await ensureDatabaseSchema(env);
        const body = await request.json();
        const { installmentId, accountId, paidDate } = body;

        const inst = await env.DB.prepare("SELECT * FROM pre_sale_installments WHERE id = ?").bind(installmentId).first();
        if (!inst) {
          return new Response(JSON.stringify({ error: "قسط مورد نظر یافت نشد" }), { status: 404, headers: corsHeaders });
        }
        if (inst.is_paid === 1) {
          return new Response(JSON.stringify({ error: "این قسط قبلاً پرداخت شده است" }), { status: 400, headers: corsHeaders });
        }

        const datePaid = paidDate || getTodayShamsiWorker();

        await env.DB.prepare("UPDATE pre_sale_installments SET is_paid = 1, paid_date = ? WHERE id = ?")
          .bind(datePaid, installmentId)
          .run();

        const presale = await env.DB.prepare("SELECT * FROM pre_sales WHERE id = ?").bind(inst.pre_sale_id).first();
        if (presale) {
          const buyer = await env.DB.prepare("SELECT * FROM contacts WHERE id = ?").bind(presale.contact_id).first();
          const unit = await env.DB.prepare("SELECT * FROM units WHERE id = ?").bind(presale.unit_id).first();
          const buyerName = buyer ? buyer.name : "پیش‌خریدار";
          const unitNo = unit ? unit.unit_number : "";

          const txId = "t_ps_inst_" + Date.now();
          const defaultAccId = await getFirstAccountId(env, "a1");
          const accId = accountId || defaultAccId;
          await env.DB.prepare(`
            INSERT INTO transactions (id, company_id, project_id, type, category, amount, account_id, person_name, date, description, is_non_cash, pre_sale_id, contact_id, payment_status)
            VALUES (?, 'c1', ?, 'income', 'پیش‌فروش', ?, ?, ?, ?, ?, 0, ?, ?, 'paid')
          `).bind(
            txId,
            presale.project_id,
            Number(inst.amount),
            accId,
            buyerName,
            datePaid,
            `دریافت قسط "${inst.installment_name}" قرارداد پیش‌فروش واحد ${unitNo}`,
            presale.id,
            presale.contact_id
          ).run();

          await env.DB.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?")
            .bind(Number(inst.amount), accId)
            .run();

          if (buyer) {
            const newBuyerBal = Math.max(0, Number(buyer.balance || 0) - Number(inst.amount));
            await env.DB.prepare("UPDATE contacts SET balance = ? WHERE id = ?").bind(newBuyerBal, presale.contact_id).run();
          }
        }

        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      // 9f-4. Register Pre-Sale Payment Document
      if (path === "/api/presales/payments/add" && method === "POST") {
        await ensureDatabaseSchema(env);
        const body = await request.json();
        const { preSaleId, amount, accountId, paidDate, referenceNumber, invoiceNumber, invoiceDescription, description } = body;
        const presale = await env.DB.prepare("SELECT * FROM pre_sales WHERE id = ?").bind(preSaleId).first();
        if (!presale) {
          return new Response(JSON.stringify({ error: "قرارداد پیش‌فروش یافت نشد" }), { status: 404, headers: corsHeaders });
        }
        const buyer = await env.DB.prepare("SELECT * FROM contacts WHERE id = ?").bind(presale.contact_id).first();
        const unit = await env.DB.prepare("SELECT * FROM units WHERE id = ?").bind(presale.unit_id).first();
        const defaultAccId = await getFirstAccountId(env, "a1");
        const resolvedAccountId = accountId || defaultAccId;
        const payVal = Number(amount || 0);
        const finalDesc = description || invoiceDescription || `دریافت پرداختی پیش‌فروش واحد ${unit ? unit.unit_number : ""} - شماره سند ${referenceNumber || ""}`;
        const txId = "t_ps_pay_" + Date.now();
        const payments = [{
          id: "p_psp_" + Date.now(),
          rowNumber: 1,
          amount: payVal,
          date: paidDate,
          accountId: resolvedAccountId,
          referenceNumber,
          invoiceNumber: invoiceNumber || "",
          invoiceDescription: invoiceDescription || finalDesc,
          description: finalDesc
        }];

        await env.DB.prepare(`
          INSERT INTO transactions (id, company_id, project_id, type, category, amount, account_id, person_name, date, description, invoice_number, is_non_cash, pre_sale_id, contact_id, payment_status, payments_json)
          VALUES (?, 'c1', ?, 'income', 'پیش‌فروش', ?, ?, ?, ?, ?, ?, 0, ?, ?, 'paid', ?)
        `).bind(txId, presale.project_id, payVal, resolvedAccountId, buyer ? buyer.name : "پیش‌خریدار", paidDate, finalDesc, invoiceNumber || "", preSaleId, presale.contact_id, JSON.stringify(payments)).run();

        await env.DB.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(payVal, resolvedAccountId).run();
        if (buyer) {
          await env.DB.prepare("UPDATE contacts SET balance = MAX(0, COALESCE(balance, 0) - ?) WHERE id = ?").bind(payVal, presale.contact_id).run();
        }
        return new Response(JSON.stringify({ status: "success", id: txId }), { headers: corsHeaders });
      }

      // 9g. Record SMS Alert
      if (path === "/api/alerts" && method === "POST") {
        const alert = await request.json();
        const id = "al_" + Date.now();
        const todayShamsi = getTodayShamsiWorker();

        await env.DB.prepare(`
          INSERT INTO alerts_log (id, type, reference_id, recipient_phone, message, send_date, is_sent)
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `).bind(
          id,
          alert.type || "installment",
          alert.referenceId || "",
          alert.recipientPhone || "",
          alert.message || "",
          todayShamsi
        ).run();

        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      // 9g-2. Timesheets & Payrolls Endpoints
      if (path === "/api/timesheets" && method === "POST") {
        await ensureDatabaseSchema(env);
        const body = await request.json();
        const id = body.id || "ts_" + Date.now();
        await env.DB.prepare(`
          INSERT INTO timesheets (id, project_id, contact_id, person_name, date, hours_worked, overtime_hours, daily_rate, overtime_rate, total_pay, stage, description, is_paid)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            project_id=excluded.project_id,
            contact_id=excluded.contact_id,
            person_name=excluded.person_name,
            date=excluded.date,
            hours_worked=excluded.hours_worked,
            overtime_hours=excluded.overtime_hours,
            daily_rate=excluded.daily_rate,
            overtime_rate=excluded.overtime_rate,
            total_pay=excluded.total_pay,
            stage=excluded.stage,
            description=excluded.description,
            is_paid=excluded.is_paid
        `).bind(
          id,
          body.projectId,
          body.contactId || null,
          body.personName || "",
          body.date || getTodayShamsiWorker(),
          Number(body.hoursWorked || 0),
          Number(body.overtimeHours || 0),
          Number(body.dailyRate || 0),
          Number(body.overtimeRate || 0),
          Number(body.totalPay || 0),
          body.stage || "سفت‌کاری",
          body.description || "",
          body.isPaid ? 1 : 0
        ).run();
        return new Response(JSON.stringify({ status: "success", id }), { headers: corsHeaders });
      }

      if (path === "/api/timesheets/delete" && method === "POST") {
        const body = await request.json();
        await env.DB.prepare("DELETE FROM timesheets WHERE id = ?").bind(body.id).run();
        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      if (path === "/api/payrolls" && method === "POST") {
        await ensureDatabaseSchema(env);
        const body = await request.json();
        const id = body.id || "pr_" + Date.now();
        await env.DB.prepare(`
          INSERT INTO payrolls (id, project_id, contact_id, person_name, month, year, base_salary, housing_allowance, food_allowance, child_allowance, overtime_hours, overtime_pay, bonuses, insurance_worker, insurance_employer, tax_deduction, advance_deduction, other_deductions, gross_salary, net_payable, payment_date, account_id, is_paid)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            is_paid=excluded.is_paid,
            net_payable=excluded.net_payable,
            gross_salary=excluded.gross_salary
        `).bind(
          id,
          body.projectId,
          body.contactId || null,
          body.personName || "",
          body.month || "",
          body.year || "",
          Number(body.baseSalary || 0),
          Number(body.housingAllowance || 0),
          Number(body.foodAllowance || 0),
          Number(body.childAllowance || 0),
          Number(body.overtimeHours || 0),
          Number(body.overtimePay || 0),
          Number(body.bonuses || 0),
          Number(body.insuranceWorker || 0),
          Number(body.insuranceEmployer || 0),
          Number(body.taxDeduction || 0),
          Number(body.advanceDeduction || 0),
          Number(body.otherDeductions || 0),
          Number(body.grossSalary || 0),
          Number(body.netPayable || 0),
          body.paymentDate || getTodayShamsiWorker(),
          body.accountId || "a1",
          body.isPaid ? 1 : 0
        ).run();
        return new Response(JSON.stringify({ status: "success", id }), { headers: corsHeaders });
      }

      if (path === "/api/payrolls/delete" && method === "POST") {
        const body = await request.json();
        await env.DB.prepare("DELETE FROM payrolls WHERE id = ?").bind(body.id).run();
        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      // Fallback for missing routes
      return new Response(JSON.stringify({
        message: "Cloudflare D1 construction serverless gateway running.",
        status: "alive"
      }), { headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};
