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
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT, role_name TEXT, username TEXT, password TEXT)`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`
  ];

  for (const q of schemaQueries) {
    try {
      await env.DB.prepare(q).run();
    } catch (e) {
      console.error("Schema creation failed for query:", q, e);
    }
  }

  // Ensure accounts table has new columns code, level, parent_code, nature if they do not exist
  try { await env.DB.prepare("ALTER TABLE accounts ADD COLUMN code TEXT").run(); } catch(e){}
  try { await env.DB.prepare("ALTER TABLE accounts ADD COLUMN level INTEGER").run(); } catch(e){}
  try { await env.DB.prepare("ALTER TABLE accounts ADD COLUMN parent_code TEXT").run(); } catch(e){}
  try { await env.DB.prepare("ALTER TABLE accounts ADD COLUMN nature TEXT").run(); } catch(e){}

  // Ensure projects and units have is_deleted and deleted_at columns
  try { await env.DB.prepare("ALTER TABLE projects ADD COLUMN is_deleted INTEGER DEFAULT 0").run(); } catch(e){}
  try { await env.DB.prepare("ALTER TABLE projects ADD COLUMN deleted_at TEXT").run(); } catch(e){}
  try { await env.DB.prepare("ALTER TABLE units ADD COLUMN is_deleted INTEGER DEFAULT 0").run(); } catch(e){}
  try { await env.DB.prepare("ALTER TABLE units ADD COLUMN deleted_at TEXT").run(); } catch(e){}

  // Auto-seed if companies table is empty
  try {
    const checkCompany = await env.DB.prepare("SELECT COUNT(*) as count FROM companies").first();
    if (!checkCompany || checkCompany.count === 0) {
      console.log("Database is empty, auto-seeding...");
      
      // Seed Users
      await env.DB.prepare("INSERT INTO users (id, name, role, role_name, username, password) VALUES ('u1', 'مهندس میلاد فرخی', 'manager', 'مدیر ارشد پروژه', 'admin', 'Miladlar224')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO users (id, name, role, role_name, username, password) VALUES ('u2', 'خانم مریم احمدی', 'accountant', 'حسابدار مالی', 'accountant', '123456')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO users (id, name, role, role_name, username, password) VALUES ('u3', 'حاج علی عباسی', 'investor', 'سرمایه‌گذار شریک', 'investor', '123456')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO users (id, name, role, role_name, username, password) VALUES ('u4', 'مهندس علیرضا اکبری', 'supervisor', 'سرپرست کارگاه', 'supervisor', '123456')").run().catch(() => {});
      
      // Seed Companies
      await env.DB.prepare("INSERT INTO companies (id, name, code) VALUES ('c1', 'شرکت عمرانی رادین سازه شیراز', '10243')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO companies (id, name, code) VALUES ('c2', 'پیشگامان مسکن مهرگان', '55890')").run().catch(() => {});

      // Seed Projects
      const p1Stages = JSON.stringify(["خاک‌برداری و پی‌ریزی", "اسکلت بتنی", "سفت‌کاری و دیوارچینی", "نازک‌کاری و نما", "تأسیسات الکتریکال و مکانیکال", "پایان کار و دکوراسیون داخلی"]);
      await env.DB.prepare(`
        INSERT INTO projects (id, company_id, name, address, total_area, budget, stages, current_stage, status)
        VALUES ('p1', 'c1', 'پروژه مسکونی مروارید نیاوران', 'تهران، نیاوران، خیابان یاسر، پلاک ۱۲', 2400, 48000000000, ?, 'سفت‌کاری و دیوارچینی', 'active')
      `).bind(p1Stages).run().catch(() => {});

      const p2Stages = JSON.stringify(["پایدارسازی و نیلینگ", "فونداسیون", "اسکلت فلزی پیچ و مهره", "سفت‌کاری", "تأسیسات و اطفاء حریق", "شیشه‌گذاری و دکوراسیون"]);
      await env.DB.prepare(`
        INSERT INTO projects (id, company_id, name, address, total_area, budget, stages, current_stage, status)
        VALUES ('p2', 'c1', 'مجتمع تجاری آرامش سعادت‌آباد', 'تهران، سعادت‌آباد، میدان کاج، نبش خیابان نهم', 5500, 120000000000, ?, 'اسکلت فلزی پیچ و مهره', 'active')
      `).bind(p2Stages).run().catch(() => {});

      // Seed Accounts with standard codes
      await env.DB.prepare("INSERT INTO accounts (id, name, type, type_name, account_number, bank_name, balance, code, level, parent_code, nature) VALUES ('a1', 'بانک ملی - جاری کارفرما (۱۴۰۲)', 'bank', 'بانک تجاری', '0105432109002', 'ملی ایران', 14200000000, '101001', 3, '101', 'debtor')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO accounts (id, name, type, type_name, account_number, bank_name, balance, code, level, parent_code, nature) VALUES ('a2', 'بانک سامان - حساب مرکزی پشتیبان', 'bank', 'بانک تجاری', '844-3210-993-1', 'سامان', 28500000000, '101002', 3, '101', 'debtor')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO accounts (id, name, type, type_name, balance, code, level, parent_code, nature) VALUES ('a3', 'صندوق تنخواه کارگاه (مهندس اکبری)', 'petty_cash', 'تنخواه گردان کارگاه', 45000000, '101003', 3, '101', 'debtor')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO accounts (id, name, type, type_name, balance, code, level, parent_code, nature) VALUES ('a4', 'علی عباسی (سرمایه‌گذار شریک)', 'investor', 'حساب سرمایه‌گذار', -8000000000, '301001', 3, '301', 'creditor')").run().catch(() => {});

      // Seed Contacts
      await env.DB.prepare("INSERT INTO contacts (id, name, phone, role, national_id, bank_card_number, balance, created_at) VALUES ('co1', 'خانم دکتر مهدوی', '09121111111', 'pre_buyer', '0012233445', '6037991122334455', 23800000000, '1403/01/20')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO contacts (id, name, phone, role, national_id, bank_card_number, balance, created_at) VALUES ('co2', 'مهندس شفیعی', '09122222222', 'pre_buyer', '0022233446', '6104332211005544', 30400000000, '1403/02/01')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO contacts (id, name, phone, role, national_id, balance, created_at) VALUES ('co3', 'شرکت فلزات آریا', '02188888888', 'subcontractor', '10100293810', -8000000000, '1403/01/10')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO contacts (id, name, phone, role, national_id, balance, created_at) VALUES ('co4', 'صنایع بتن تهران کادوس', '02144444444', 'supplier', '14002931201', -1800000000, '1403/01/15')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO contacts (id, name, phone, role, national_id, balance, created_at) VALUES ('co5', 'مهندس علیرضا اکبری', '09123333333', 'imprest_holder', '0033344556', 450000000, '1403/01/10')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO contacts (id, name, phone, role, national_id, balance, created_at) VALUES ('co6', 'مهندس کریمی', '09124444444', 'imprest_holder', '0044455667', 350000000, '1403/01/12')").run().catch(() => {});

      // Seed Imprest Funds
      await env.DB.prepare("INSERT INTO imprest_funds (id, project_id, contact_id, allocated_limit, balance, status, last_reconciliation_date, created_at) VALUES ('im1', 'p1', 'co5', 500000000, 450000000, 'active', '1403/01/10', '1403/01/10')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO imprest_funds (id, project_id, contact_id, allocated_limit, balance, status, last_reconciliation_date, created_at) VALUES ('im2', 'p2', 'co6', 400000000, 350000000, 'active', '1403/01/12', '1403/01/12')").run().catch(() => {});

      // Seed Imprest Expenses
      await env.DB.prepare("INSERT INTO imprest_expenses (id, imprest_id, expense_date, amount, description, material_category, status, created_at) VALUES ('ie1', 'im1', '1403/02/12', 50000000, 'خرید لوله اتصالات پلیکا فاضلابی کارگاه', 'تأسیسات', 'approved', '1403/02/12')").run().catch(() => {});

      // Seed Pre-sales
      await env.DB.prepare("INSERT INTO pre_sales (id, project_id, contact_id, unit_id, contract_area, price_per_meter, total_price, contract_date, status) VALUES ('ps1', 'p1', 'co1', 'u_102', 140, 170000000, 23800000000, '1403/01/20', 'active')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO pre_sales (id, project_id, contact_id, unit_id, contract_area, price_per_meter, total_price, contract_date, status) VALUES ('ps2', 'p1', 'co2', 'u_201', 160, 190000000, 30400000000, '1403/02/01', 'active')").run().catch(() => {});

      // Seed Pre-sale Installments
      await env.DB.prepare("INSERT INTO pre_sale_installments (id, pre_sale_id, installment_name, due_date, amount, is_paid, paid_date) VALUES ('psi1', 'ps1', 'پیش‌پرداخت (عقد قرارداد)', '1403/01/20', 8000000000, 1, '1403/01/20')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO pre_sale_installments (id, pre_sale_id, installment_name, due_date, amount, is_paid, paid_date) VALUES ('psi2', 'ps1', 'پایان پی‌ریزی و فونداسیون', '1403/06/15', 2380000000, 0, NULL)").run().catch(() => {});
      await env.DB.prepare("INSERT INTO pre_sale_installments (id, pre_sale_id, installment_name, due_date, amount, is_paid, paid_date) VALUES ('psi3', 'ps1', 'پایان اسکلت و سازه', '1403/09/01', 3570000000, 0, NULL)").run().catch(() => {});
      await env.DB.prepare("INSERT INTO pre_sale_installments (id, pre_sale_id, installment_name, due_date, amount, is_paid, paid_date) VALUES ('psi4', 'ps2', 'پیش‌پرداخت (عقد قرارداد)', '1403/02/01', 15000000000, 1, '1403/02/01')").run().catch(() => {});

      // Seed Materials
      await env.DB.prepare("INSERT INTO materials (id, name, category, unit, stock, average_price) VALUES ('m1', 'میلگرد آجدار سایز ۱۶', 'فلزات', 'تن', 12.5, 29000000)").run().catch(() => {});
      await env.DB.prepare("INSERT INTO materials (id, name, category, unit, stock, average_price) VALUES ('m2', 'سیمان تیپ ۲ شیراز', 'مصالح عمومی', 'کیسه', 450, 85000)").run().catch(() => {});
      await env.DB.prepare("INSERT INTO materials (id, name, category, unit, stock, average_price) VALUES ('m3', 'شن و ماسه شسته', 'مصالح عمومی', 'کامیون', 14, 1800000)").run().catch(() => {});
      await env.DB.prepare("INSERT INTO materials (id, name, category, unit, stock, average_price) VALUES ('m4', 'بلوک لیکا دیواری ۱۵', 'دیوارچینی', 'عدد', 3200, 14000)").run().catch(() => {});

      // Seed Units
      await env.DB.prepare("INSERT INTO units (id, project_id, unit_number, floor, area, price_per_meter, total_price, status, buyer_name, down_payment, barter_property, specific_expenses) VALUES ('u_101', 'p1', 'واحد ۱۰۱', 'اول', 120, 180000000, 21600000000, 'available', NULL, NULL, NULL, '[]')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO units (id, project_id, unit_number, floor, area, price_per_meter, total_price, status, buyer_name, down_payment, barter_property, specific_expenses) VALUES ('u_102', 'p1', 'واحد ۱۰۲', 'اول', 150, 180000000, 27000000000, 'sold', 'دکتر علوی', 12000000000, NULL, '[]')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO units (id, project_id, unit_number, floor, area, price_per_meter, total_price, status, buyer_name, down_payment, barter_property, specific_expenses) VALUES ('u_201', 'p1', 'واحد ۲۰۱', 'دوم', 120, 190000000, 22800000000, 'pre_sold', 'خانم دکتر مهدوی', 8000000000, NULL, '[]')").run().catch(() => {});
      await env.DB.prepare("INSERT INTO units (id, project_id, unit_number, floor, area, price_per_meter, total_price, status, buyer_name, down_payment, barter_property, specific_expenses) VALUES ('u_202', 'p1', 'واحد ۲۰۲', 'دوم', 150, 195000000, 29250000000, 'bartered', 'مجموعه آجر نسوز پارس', 10000000000, 'تأمین آجرهای نمای کل پروژه تهاتر شد', '[]')").run().catch(() => {});
    }
  } catch (err) {
    console.error("Auto-seeding check failed:", err);
  }
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

        // Dynamic Users list mapped back to frontend expectations
        const users = (usersQ.results || []).map(u => ({
          id: u.id,
          name: u.name,
          role: u.role,
          roleName: u.role_name || u.roleName,
          username: u.username,
          password: u.password
        }));

        // Structure results with camelCase mapping
        const result = {
          companies: keysToCamel(companiesQ.results || []),
          projects: (projectsQ.results || []).map(p => {
            const camel = keysToCamel(p);
            camel.stages = p.stages ? JSON.parse(p.stages) : ["خاک‌برداری", "اسکلت", "سفت‌کاری", "تأسیسات", "نازک‌کاری", "نما", "پایان کار"];
            return camel;
          }),
          users: users,
          accounts: keysToCamel(accountsQ.results || []),
          materials: keysToCamel(materialsQ.results || []),
          materialTransactions: keysToCamel(materialTxsQ.results || []),
          transactions: (transactionsQ.results || []).map(t => {
            const camel = keysToCamel(t);
            camel.isNonCash = t.is_non_cash === 1;
            if (t.barter_property_type) {
              camel.barterDetails = {
                propertyType: t.barter_property_type,
                description: t.barter_description || "",
                agreedValue: t.barter_agreed_value || 0
              };
            }
            return camel;
          }),
          checks: (checksQ.results || []).map(c => {
            const camel = keysToCamel(c);
            return camel;
          }),
          units: (unitsQ.results || []).map(u => {
            const camel = keysToCamel(u);
            camel.specificExpenses = u.specific_expenses ? JSON.parse(u.specific_expenses) : [];
            return camel;
          }),
          contacts: keysToCamel(contactsQ.results || []),
          imprestFunds: keysToCamel(imprestFundsQ.results || []),
          imprestExpenses: keysToCamel(imprestExpensesQ.results || []),
          preSales: keysToCamel(preSalesQ.results || []),
          preSaleInstallments: (preSaleInstallmentsQ.results || []).map(i => {
            const camel = keysToCamel(i);
            camel.isPaid = i.is_paid === 1;
            return camel;
          }),
          alertsLog: (alertsLogQ.results || []).map(a => {
            const camel = keysToCamel(a);
            camel.isSent = a.is_sent === 1;
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
        const tables = ["companies", "projects", "accounts", "materials", "material_transactions", "transactions", "checks", "units", "contacts", "imprest_funds", "imprest_expenses", "pre_sales", "pre_sale_installments", "alerts_log", "users"];
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
            INSERT INTO projects (id, company_id, name, address, total_area, budget, stages, current_stage, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.companyId || "c1",
            item.name,
            item.address || null,
            Number(item.totalArea || 0),
            Number(item.budget || 0),
            stagesStr,
            item.currentStage || "خاک‌برداری",
            item.status || "active"
          ));
        }

        // 4. Insert Accounts
        for (const item of incomingDb.accounts || []) {
          batchQueries.push(env.DB.prepare(`
            INSERT INTO accounts (id, name, type, type_name, account_number, bank_name, balance, code, level, parent_code, nature)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            item.nature || null
          ));
        }

        // 5. Insert Contacts
        for (const item of incomingDb.contacts || []) {
          batchQueries.push(env.DB.prepare(`
            INSERT INTO contacts (id, name, phone, role, national_id, bank_card_number, balance, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.name,
            item.phone || "",
            item.role || "pre_buyer",
            item.nationalId || null,
            item.bankCardNumber || null,
            Number(item.balance || 0),
            item.createdAt || "1403/04/03"
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
            item.lastReconciliationDate || "1403/04/03",
            item.createdAt || "1403/04/03"
          ));
        }

        // 7. Insert Imprest Expenses
        for (const item of incomingDb.imprestExpenses || []) {
          batchQueries.push(env.DB.prepare(`
            INSERT INTO imprest_expenses (id, imprest_id, expense_date, amount, description, material_category, attachment_url, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.imprestId,
            item.expenseDate || "1403/04/03",
            Number(item.amount || 0),
            item.description || "",
            item.materialCategory || "سایر",
            item.attachmentUrl || null,
            item.status || "approved",
            item.createdAt || "1403/04/03"
          ));
        }

        // 8. Insert Pre-Sales
        for (const item of incomingDb.preSales || []) {
          batchQueries.push(env.DB.prepare(`
            INSERT INTO pre_sales (id, project_id, contact_id, unit_id, contract_area, price_per_meter, total_price, contract_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.projectId,
            item.contactId,
            item.unitId,
            Number(item.contractArea || 0),
            Number(item.pricePerMeter || 0),
            Number(item.totalPrice || 0),
            item.contractDate || "1403/04/03",
            item.status || "active"
          ));
        }

        // 9. Insert Pre-Sale Installments
        for (const item of incomingDb.preSaleInstallments || []) {
          batchQueries.push(env.DB.prepare(`
            INSERT INTO pre_sale_installments (id, pre_sale_id, installment_name, due_date, amount, is_paid, paid_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.preSaleId,
            item.installmentName,
            item.dueDate,
            Number(item.amount || 0),
            item.isPaid ? 1 : 0,
            item.paidDate || null
          ));
        }

        // 10. Insert Materials
        for (const item of incomingDb.materials || []) {
          batchQueries.push(env.DB.prepare(`
            INSERT INTO materials (id, name, category, unit, stock, average_price)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.name,
            item.category || "عمومی",
            item.unit || "عدد",
            Number(item.stock || 0),
            Number(item.averagePrice || 0)
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
            INSERT INTO transactions (id, company_id, project_id, type, category, sub_category, amount, account_id, person_name, date, description, is_non_cash, barter_property_type, barter_description, barter_agreed_value, attachment_name, attachment_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            isNonCashVal,
            barterPropType,
            barterDesc,
            barterValue,
            item.attachmentName || null,
            item.attachmentData || null
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
            INSERT INTO units (id, project_id, unit_number, floor, area, price_per_meter, total_price, status, buyer_name, down_payment, barter_property, specific_expenses)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            item.id,
            item.projectId,
            item.unitNumber,
            item.floor || null,
            Number(item.area || 0),
            Number(item.pricePerMeter || 0),
            Number(item.totalPrice || 0),
            item.status || "available",
            item.buyerName || null,
            item.downPayment !== null && item.downPayment !== undefined ? Number(item.downPayment) : null,
            item.barterProperty || null,
            specExpStr
          ));
        }

        // 15. Insert Users
        if (incomingDb.users && Array.isArray(incomingDb.users)) {
          for (const item of incomingDb.users) {
            batchQueries.push(env.DB.prepare(`
              INSERT INTO users (id, name, role, role_name, username, password)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind(
              item.id,
              item.name,
              item.role || "supervisor",
              item.roleName || "ناظر پروژه",
              item.username || null,
              item.password || null
            ));
          }
        }

        const chunkSize = 100;
        for (let i = 0; i < batchQueries.length; i += chunkSize) {
          const chunk = batchQueries.slice(i, i + chunkSize);
          await env.DB.batch(chunk);
        }

        return new Response(JSON.stringify({ 
          status: "success", 
          message: "دیتابیس ابری با داده‌های آفلاین همگام‌سازی و بروز رسانی شد.",
          statistics: {
            projects: incomingDb.projects.length,
            transactions: incomingDb.transactions.length
          }
        }), { headers: corsHeaders });
      }

      // 3. Reset/Re-seed D1 database
      if (path === "/api/db/reset" && method === "POST") {
        // Clear all
        await env.DB.prepare("DELETE FROM companies").run();
        await env.DB.prepare("DELETE FROM projects").run();
        await env.DB.prepare("DELETE FROM accounts").run();
        await env.DB.prepare("DELETE FROM materials").run();
        await env.DB.prepare("DELETE FROM material_transactions").run();
        await env.DB.prepare("DELETE FROM transactions").run();
        await env.DB.prepare("DELETE FROM checks").run();
        await env.DB.prepare("DELETE FROM units").run();
        await env.DB.prepare("DELETE FROM contacts").run();
        await env.DB.prepare("DELETE FROM imprest_funds").run();
        await env.DB.prepare("DELETE FROM imprest_expenses").run();
        await env.DB.prepare("DELETE FROM pre_sales").run();
        await env.DB.prepare("DELETE FROM pre_sale_installments").run();
        await env.DB.prepare("DELETE FROM alerts_log").run();

        // Seed Companies
        await env.DB.prepare("INSERT INTO companies (id, name, code) VALUES ('c1', 'شرکت عمرانی رادین سازه شیراز', '10243')").run();
        await env.DB.prepare("INSERT INTO companies (id, name, code) VALUES ('c2', 'پیشگامان مسکن مهرگان', '55890')").run();

        // Seed Projects
        const p1Stages = JSON.stringify(["خاک‌برداری و پی‌ریزی", "اسکلت بتنی", "سفت‌کاری و دیوارچینی", "نازک‌کاری و نما", "تأسیسات الکتریکال و مکانیکال", "پایان کار و دکوراسیون داخلی"]);
        await env.DB.prepare(`
          INSERT INTO projects (id, company_id, name, address, total_area, budget, stages, current_stage, status)
          VALUES ('p1', 'c1', 'پروژه مسکونی مروارید نیاوران', 'تهران، نیاوران، خیابان یاسر، پلاک ۱۲', 2400, 48000000000, ?, 'سفت‌کاری و دیوارچینی', 'active')
        `).bind(p1Stages).run();

        const p2Stages = JSON.stringify(["پایدارسازی و نیلینگ", "فونداسیون", "اسکلت فلزی پیچ و مهره", "سفت‌کاری", "تأسیسات و اطفاء حریق", "شیشه‌گذاری و دکوراسیون"]);
        await env.DB.prepare(`
          INSERT INTO projects (id, company_id, name, address, total_area, budget, stages, current_stage, status)
          VALUES ('p2', 'c1', 'مجتمع تجاری آرامش سعادت‌آباد', 'تهران، سعادت‌آباد، میدان کاج، نبش خیابان نهم', 5500, 120000000000, ?, 'اسکلت فلزی پیچ و مهره', 'active')
        `).bind(p2Stages).run();

        // Seed Accounts with standard codes
        await env.DB.prepare("INSERT INTO accounts (id, name, type, type_name, account_number, bank_name, balance, code, level, parent_code, nature) VALUES ('a1', 'بانک ملی - جاری کارفرما (۱۴۰۲)', 'bank', 'بانک تجاری', '0105432109002', 'ملی ایران', 14200000000, '101001', 3, '101', 'debtor')").run();
        await env.DB.prepare("INSERT INTO accounts (id, name, type, type_name, account_number, bank_name, balance, code, level, parent_code, nature) VALUES ('a2', 'بانک سامان - حساب مرکزی پشتیبان', 'bank', 'بانک تجاری', '844-3210-993-1', 'سامان', 28500000000, '101002', 3, '101', 'debtor')").run();
        await env.DB.prepare("INSERT INTO accounts (id, name, type, type_name, balance, code, level, parent_code, nature) VALUES ('a3', 'صندوق تنخواه کارگاه (مهندس اکبری)', 'petty_cash', 'تنخواه گردان کارگاه', 45000000, '101003', 3, '101', 'debtor')").run();
        await env.DB.prepare("INSERT INTO accounts (id, name, type, type_name, balance, code, level, parent_code, nature) VALUES ('a4', 'علی عباسی (سرمایه‌گذار شریک)', 'investor', 'حساب سرمایه‌گذار', -8000000000, '301001', 3, '301', 'creditor')").run();

        // Seed Contacts
        await env.DB.prepare("INSERT INTO contacts (id, name, phone, role, national_id, bank_card_number, balance, created_at) VALUES ('co1', 'خانم دکتر مهدوی', '09121111111', 'pre_buyer', '0012233445', '6037991122334455', 23800000000, '1403/01/20')").run();
        await env.DB.prepare("INSERT INTO contacts (id, name, phone, role, national_id, bank_card_number, balance, created_at) VALUES ('co2', 'مهندس شفیعی', '09122222222', 'pre_buyer', '0022233446', '6104332211005544', 30400000000, '1403/02/01')").run();
        await env.DB.prepare("INSERT INTO contacts (id, name, phone, role, national_id, balance, created_at) VALUES ('co3', 'شرکت فلزات آریا', '02188888888', 'subcontractor', '10100293810', -8000000000, '1403/01/10')").run();
        await env.DB.prepare("INSERT INTO contacts (id, name, phone, role, national_id, balance, created_at) VALUES ('co4', 'صنایع بتن تهران کادوس', '02144444444', 'supplier', '14002931201', -1800000000, '1403/01/15')").run();
        await env.DB.prepare("INSERT INTO contacts (id, name, phone, role, national_id, balance, created_at) VALUES ('co5', 'مهندس علیرضا اکبری', '09123333333', 'imprest_holder', '0033344556', 450000000, '1403/01/10')").run();
        await env.DB.prepare("INSERT INTO contacts (id, name, phone, role, national_id, balance, created_at) VALUES ('co6', 'مهندس کریمی', '09124444444', 'imprest_holder', '0044455667', 350000000, '1403/01/12')").run();

        // Seed Imprest Funds
        await env.DB.prepare("INSERT INTO imprest_funds (id, project_id, contact_id, allocated_limit, balance, status, last_reconciliation_date, created_at) VALUES ('im1', 'p1', 'co5', 500000000, 450000000, 'active', '1403/01/10', '1403/01/10')").run();
        await env.DB.prepare("INSERT INTO imprest_funds (id, project_id, contact_id, allocated_limit, balance, status, last_reconciliation_date, created_at) VALUES ('im2', 'p2', 'co6', 400000000, 350000000, 'active', '1403/01/12', '1403/01/12')").run();

        // Seed Imprest Expenses
        await env.DB.prepare("INSERT INTO imprest_expenses (id, imprest_id, expense_date, amount, description, material_category, status, created_at) VALUES ('ie1', 'im1', '1403/02/12', 50000000, 'خرید لوله اتصالات پلیکا فاضلابی کارگاه', 'تأسیسات', 'approved', '1403/02/12')").run();

        // Seed Pre-sales
        await env.DB.prepare("INSERT INTO pre_sales (id, project_id, contact_id, unit_id, contract_area, price_per_meter, total_price, contract_date, status) VALUES ('ps1', 'p1', 'co1', 'u_102', 140, 170000000, 23800000000, '1403/01/20', 'active')").run();
        await env.DB.prepare("INSERT INTO pre_sales (id, project_id, contact_id, unit_id, contract_area, price_per_meter, total_price, contract_date, status) VALUES ('ps2', 'p1', 'co2', 'u_201', 160, 190000000, 30400000000, '1403/02/01', 'active')").run();

        // Seed Pre-sale Installments
        await env.DB.prepare("INSERT INTO pre_sale_installments (id, pre_sale_id, installment_name, due_date, amount, is_paid, paid_date) VALUES ('psi1', 'ps1', 'پیش‌پرداخت (عقد قرارداد)', '1403/01/20', 8000000000, 1, '1403/01/20')").run();
        await env.DB.prepare("INSERT INTO pre_sale_installments (id, pre_sale_id, installment_name, due_date, amount, is_paid, paid_date) VALUES ('psi2', 'ps1', 'پایان پی‌ریزی و فونداسیون', '1403/06/15', 2380000000, 0, NULL)").run();
        await env.DB.prepare("INSERT INTO pre_sale_installments (id, pre_sale_id, installment_name, due_date, amount, is_paid, paid_date) VALUES ('psi3', 'ps1', 'پایان اسکلت و سازه', '1403/09/01', 3570000000, 0, NULL)").run();
        await env.DB.prepare("INSERT INTO pre_sale_installments (id, pre_sale_id, installment_name, due_date, amount, is_paid, paid_date) VALUES ('psi4', 'ps2', 'پیش‌پرداخت (عقد قرارداد)', '1403/02/01', 15000000000, 1, '1403/02/01')").run();

        // Seed Materials
        await env.DB.prepare("INSERT INTO materials (id, name, category, unit, stock, average_price) VALUES ('m1', 'میلگرد آجدار سایز ۱۶', 'فلزات', 'تن', 12.5, 29000000)").run();
        await env.DB.prepare("INSERT INTO materials (id, name, category, unit, stock, average_price) VALUES ('m2', 'سیمان تیپ ۲ شیراز', 'مصالح عمومی', 'کیسه', 450, 85000)").run();
        await env.DB.prepare("INSERT INTO materials (id, name, category, unit, stock, average_price) VALUES ('m3', 'شن و ماسه شسته', 'مصالح عمومی', 'کامیون', 14, 1800000)").run();
        await env.DB.prepare("INSERT INTO materials (id, name, category, unit, stock, average_price) VALUES ('m4', 'بلوک لیکا دیواری ۱۵', 'دیوارچینی', 'عدد', 3200, 14000)").run();

        // Seed Units
        await env.DB.prepare("INSERT INTO units (id, project_id, unit_number, floor, area, price_per_meter, total_price, status, buyer_name, down_payment, barter_property, specific_expenses) VALUES ('u_101', 'p1', 'واحد ۱۰۱', 'اول', 120, 180000000, 21600000000, 'available', NULL, NULL, NULL, '[]')").run();
        await env.DB.prepare("INSERT INTO units (id, project_id, unit_number, floor, area, price_per_meter, total_price, status, buyer_name, down_payment, barter_property, specific_expenses) VALUES ('u_102', 'p1', 'واحد ۱۰۲', 'اول', 150, 180000000, 27000000000, 'sold', 'دکتر علوی', 12000000000, NULL, '[]')").run();
        await env.DB.prepare("INSERT INTO units (id, project_id, unit_number, floor, area, price_per_meter, total_price, status, buyer_name, down_payment, barter_property, specific_expenses) VALUES ('u_201', 'p1', 'واحد ۲۰۱', 'دوم', 120, 190000000, 22800000000, 'pre_sold', 'خانم دکتر مهدوی', 8000000000, NULL, '[]')").run();
        await env.DB.prepare("INSERT INTO units (id, project_id, unit_number, floor, area, price_per_meter, total_price, status, buyer_name, down_payment, barter_property, specific_expenses) VALUES ('u_202', 'p1', 'واحد ۲۰۲', 'دوم', 150, 195000000, 29250000000, 'bartered', 'مجموعه آجر نسوز پارس', 10000000000, 'تأمین آجرهای نمای کل پروژه تهاتر شد', '[]')").run();

        return new Response(JSON.stringify({ status: "success", message: "پایگاه داده زنده کلودفلر باموفقیت راه‌اندازی شد." }), { headers: corsHeaders });
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

      // Delete Project
      if (path === "/api/projects/delete" && method === "POST") {
        const body = await request.json();
        const { id } = body;
        const now = new Date().toISOString();

        // Soft delete project
        await env.DB.prepare("UPDATE projects SET is_deleted = 1, deleted_at = ? WHERE id = ?").bind(now, id).run();

        // Cascade deletes matching server.ts:
        // 1. Cascade delete associated transactions
        await env.DB.prepare("DELETE FROM transactions WHERE project_id = ?").bind(id).run();
        // 2. Cascade delete associated checks
        await env.DB.prepare("DELETE FROM checks WHERE project_id = ?").bind(id).run();
        // 3. Cascade delete units
        await env.DB.prepare("DELETE FROM units WHERE project_id = ?").bind(id).run();
        // 4. Cascade delete material transactions
        await env.DB.prepare("DELETE FROM material_transactions WHERE project_id = ?").bind(id).run();
        // 5. Cascade delete preSales
        await env.DB.prepare("DELETE FROM pre_sales WHERE project_id = ?").bind(id).run();
        // 6. Cascade delete imprest funds & expenses
        const { results: imprestFunds } = await env.DB.prepare("SELECT id FROM imprest_funds WHERE project_id = ?").bind(id).all();
        const imprestIds = (imprestFunds || []).map(imp => imp.id);
        if (imprestIds.length > 0) {
          await env.DB.prepare("DELETE FROM imprest_funds WHERE project_id = ?").bind(id).run();
          for (const impId of imprestIds) {
            await env.DB.prepare("DELETE FROM imprest_expenses WHERE imprest_id = ?").bind(impId).run();
          }
        }

        return new Response(JSON.stringify({ status: "success", message: "پروژه به همراه کلیه تراکنش‌ها، واحدها و اسناد وابسته به آن حذف گردید" }), { headers: corsHeaders });
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
          const { results: funds } = await env.DB.prepare("SELECT * FROM imprest_funds WHERE id = ?").bind(expense.imprest_id).all();
          if (funds && funds.length > 0) {
            const fund = funds[0];
            const amount = Number(expense.amount || 0);
            await env.DB.prepare("UPDATE imprest_funds SET balance = balance + ? WHERE id = ?").bind(amount, fund.id).run();
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
          await env.DB.prepare("DELETE FROM pre_sale_installments WHERE pre_sale_id = ?").bind(id).run();
          await env.DB.prepare("DELETE FROM pre_sales WHERE id = ?").bind(id).run();

          return new Response(JSON.stringify({ status: "success", message: "قرارداد پیش‌فروش با موفقیت حذف شد" }), { headers: corsHeaders });
        } else {
          return new Response(JSON.stringify({ error: "قرارداد پیش‌فروش یافت نشد" }), { status: 404, headers: corsHeaders });
        }
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

        await env.DB.prepare(`
          INSERT INTO users (id, name, role, role_name, username, password)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            role = excluded.role,
            role_name = excluded.role_name,
            username = excluded.username,
            password = excluded.password
        `).bind(
          id,
          name,
          role || "supervisor",
          roleName || "ناظر پروژه",
          username ? username.trim() : "",
          password ? password.trim() : ""
        ).run();

        return new Response(JSON.stringify({ status: "success", user: { id, name, role, roleName, username, password } }), { headers: corsHeaders });
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
        const p = await request.json();
        const pId = p.id || "p_" + Date.now();
        const stagesStr = JSON.stringify(p.stages || ["خاک‌برداری", "اسکلت", "سفت‌کاری", "تأسیسات", "نازک‌کاری", "نما", "پایان کار"]);

        await env.DB.prepare(`
          INSERT INTO projects (id, company_id, name, address, total_area, budget, stages, current_stage, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            address=excluded.address,
            total_area=excluded.total_area,
            budget=excluded.budget,
            stages=excluded.stages,
            current_stage=excluded.current_stage,
            status=excluded.status
        `).bind(
          pId,
          p.companyId || "c1",
          p.name,
          p.address || null,
          Number(p.totalArea || 0),
          Number(p.budget || 0),
          stagesStr,
          p.currentStage || "خاک‌برداری",
          p.status || "active"
        ).run();

        return new Response(JSON.stringify({ status: "success", id: pId }), { headers: corsHeaders });
      }

      // 5. Create or Update Account
      if (path === "/api/accounts" && method === "POST") {
        const acc = await request.json();
        const accId = acc.id || "a_" + Date.now();

        await env.DB.prepare(`
          INSERT INTO accounts (id, name, type, type_name, account_number, bank_name, balance)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            type=excluded.type,
            type_name=excluded.type_name,
            account_number=excluded.account_number,
            bank_name=excluded.bank_name,
            balance=excluded.balance
        `).bind(
          accId,
          acc.name,
          acc.type,
          acc.typeName || "حساب",
          acc.accountNumber || null,
          acc.bankName || null,
          Number(acc.balance || 0)
        ).run();

        return new Response(JSON.stringify({ status: "success", id: accId }), { headers: corsHeaders });
      }

      // 6. Record Financial Transaction (Receipts & Payments)
      if (path === "/api/transactions" && method === "POST") {
        const tx = await request.json();
        const txId = tx.id || "t_" + Date.now();

        const isNonCashVal = tx.isNonCash ? 1 : 0;
        const barterPropType = tx.barterDetails ? tx.barterDetails.propertyType : null;
        const barterDesc = tx.barterDetails ? tx.barterDetails.description : null;
        const barterValue = tx.barterDetails ? Number(tx.barterDetails.agreedValue || 0) : null;

        // Attempt Backblaze B2 Upload if attachment exists and starts with "data:"
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
            }), { 
              status: 500, 
              headers: corsHeaders 
            });
          }
        }

        await env.DB.prepare(`
          INSERT INTO transactions (id, company_id, project_id, type, category, sub_category, amount, account_id, person_name, date, description, is_non_cash, barter_property_type, barter_description, barter_agreed_value, attachment_name, attachment_data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          txId,
          tx.companyId || "c1",
          tx.projectId,
          tx.type,
          tx.category,
          tx.subCategory || null,
          Number(tx.amount || 0),
          tx.accountId || null,
          tx.personName,
          tx.date || "",
          tx.description || "",
          isNonCashVal,
          barterPropType,
          barterDesc,
          barterValue,
          tx.attachmentName || null,
          attachmentUrl
        ).run();

        // Adjust local account balances in D1 if not non-cash
        if (!tx.isNonCash && tx.accountId) {
          const diff = tx.type === "expense" ? -Number(tx.amount || 0) : Number(tx.amount || 0);
          await env.DB.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(diff, tx.accountId).run();
        }

        return new Response(JSON.stringify({ status: "success", id: txId, attachmentUrl: attachmentUrl }), { headers: corsHeaders });
      }

      // 7. Define Materials / Record Warehouse Transactions
      if (path === "/api/materials" && method === "POST") {
        const body = await request.json();
        const isTx = !!body.projectId;

        if (isTx) {
          // Record material warehouse transaction
          const mTxId = "mt_" + Date.now();
          await env.DB.prepare(`
            INSERT INTO material_transactions (id, project_id, material_id, type, quantity, unit_price, date, person_name, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            mTxId,
            body.projectId,
            body.materialId,
            body.type, // 'in' or 'out'
            Number(body.quantity || 0),
            Number(body.unitPrice || 0),
            body.date || "",
            body.personName || "انباردار",
            body.description || ""
          ).run();

          // Calculate and update material stocks
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
          // Define or edit material asset
          const mId = body.id || "m_" + Date.now();
          await env.DB.prepare(`
            INSERT INTO materials (id, name, category, unit, stock, average_price)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name=excluded.name,
              category=excluded.category,
              unit=excluded.unit,
              stock=excluded.stock,
              average_price=excluded.average_price
          `).bind(
            mId,
            body.name,
            body.category || "عمومی",
            body.unit || "عدد",
            Number(body.stock || 0),
            Number(body.averagePrice || 0)
          ).run();

          return new Response(JSON.stringify({ status: "success", id: mId }), { headers: corsHeaders });
        }
      }

      // 8. Add/Update Check
      if (path === "/api/checks" && method === "POST") {
        const chk = await request.json();
        
        if (chk.id && chk.status) {
          // Status update (e.g., cleared check)
          const { results } = await env.DB.prepare("SELECT * FROM checks WHERE id = ?").bind(chk.id).all();
          if (results && results.length > 0) {
            const oldStatus = results[0].status;
            const check = results[0];

            await env.DB.prepare("UPDATE checks SET status = ? WHERE id = ?").bind(chk.status, chk.id).run();

            // Auto-log financial transaction if check cleared
            if (oldStatus !== "passed" && chk.status === "passed") {
              const txId = "t_ch_" + Date.now();
              const type = check.type === "outgoing" ? "expense" : "income";
              const category = "پاس شدن چک";
              const amount = Number(check.amount || 0);
              const accId = chk.accountId || "a1";

              await env.DB.prepare(`
                INSERT INTO transactions (id, company_id, project_id, type, category, amount, account_id, person_name, date, description, is_non_cash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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

              // Balance update
              const diff = type === "expense" ? -amount : amount;
              await env.DB.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(diff, accId).run();
            }
          }
          return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
        } else {
          // Add new check
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

      // 9. Update Unit Details / Record specific unit expenses
      if (path === "/api/units" && method === "POST") {
        const body = await request.json();
        const unitId = body.id;

        const { results } = await env.DB.prepare("SELECT * FROM units WHERE id = ?").bind(unitId).all();
        if (results && results.length > 0) {
          const currentUnit = results[0];
          let currentExpenses = currentUnit.specific_expenses ? JSON.parse(currentUnit.specific_expenses) : [];

          if (body.addExpense) {
            // Adding dynamic unit-specific expense
            const newExp = {
              id: "ue_" + Date.now(),
              title: body.addExpense.title,
              amount: Number(body.addExpense.amount || 0),
              date: body.addExpense.date
            };
            currentExpenses.push(newExp);

            await env.DB.prepare("UPDATE units SET specific_expenses = ? WHERE id = ?")
              .bind(JSON.stringify(currentExpenses), unitId)
              .run();

            // Deduct from builder's primary account to simulate spending
            await env.DB.prepare("UPDATE accounts SET balance = balance - ? WHERE id = 'a3'")
              .bind(Number(body.addExpense.amount || 0))
              .run();

            return new Response(JSON.stringify({ status: "success", expense: newExp }), { headers: corsHeaders });
          } else {
            // Updating standard unit parameters
            await env.DB.prepare(`
              UPDATE units SET
                status = ?,
                buyer_name = ?,
                down_payment = ?,
                barter_property = ?
              WHERE id = ?
            `).bind(
              body.status || currentUnit.status,
              body.buyerName !== undefined ? body.buyerName : currentUnit.buyer_name,
              body.downPayment !== undefined ? Number(body.downPayment || 0) : currentUnit.down_payment,
              body.barterProperty !== undefined ? body.barterProperty : currentUnit.barter_property,
              unitId
            ).run();

            return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
          }
        }
        return new Response(JSON.stringify({ error: "Unit not found" }), { status: 404, headers: corsHeaders });
      }

      // 9b. Add or Update Contact
      if (path === "/api/contacts" && method === "POST") {
        const c = await request.json();
        const id = c.id || "co_" + Date.now();
        await env.DB.prepare(`
          INSERT INTO contacts (id, name, phone, role, national_id, bank_card_number, balance, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            phone = excluded.phone,
            role = excluded.role,
            national_id = excluded.national_id,
            bank_card_number = excluded.bank_card_number,
            balance = excluded.balance
        `).bind(
          id,
          c.name,
          c.phone || "",
          c.role || "pre_buyer",
          c.nationalId || null,
          c.bankCardNumber || null,
          Number(c.balance || 0),
          c.createdAt || "1403/04/03"
        ).run();

        return new Response(JSON.stringify({ status: "success", contact: { id, ...c } }), { headers: corsHeaders });
      }

      // 9c. Add or Update Imprest Fund
      if (path === "/api/imprests" && method === "POST") {
        const f = await request.json();
        const id = f.id || "im_" + Date.now();
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
          f.lastReconciliationDate || "1403/04/03",
          f.createdAt || "1403/04/03"
        ).run();

        return new Response(JSON.stringify({ status: "success", imprestFund: { id, ...f } }), { headers: corsHeaders });
      }

      // 9d. Record Imprest Expense
      if (path === "/api/imprests/expenses" && method === "POST") {
        const exp = await request.json();
        const id = exp.id || "ie_" + Date.now();

        // Check if fund exists and is not locked
        const fund = await env.DB.prepare("SELECT * FROM imprest_funds WHERE id = ?").bind(exp.imprestId).first();
        if (!fund) {
          return new Response(JSON.stringify({ error: "تنخواه‌گردان یافت نشد" }), { status: 404, headers: corsHeaders });
        }
        if (fund.status === "locked") {
          return new Response(JSON.stringify({ error: "تنخواه‌گردان به علت عدم تسویه حساب یا سقف بدهی قفل شده است" }), { status: 400, headers: corsHeaders });
        }

        const expAmount = Number(exp.amount || 0);

        // Record expense
        await env.DB.prepare(`
          INSERT INTO imprest_expenses (id, imprest_id, expense_date, amount, description, material_category, attachment_url, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          exp.imprestId,
          exp.expenseDate || "1403/04/03",
          expAmount,
          exp.description,
          exp.materialCategory || "سایر",
          exp.attachmentUrl || null,
          exp.status || "approved",
          "1403/04/03"
        ).run();

        if ((exp.status || "approved") === "approved") {
          // Update fund balance
          const newBalance = Math.max(0, Number(fund.balance || 0) - expAmount);
          await env.DB.prepare("UPDATE imprest_funds SET balance = ? WHERE id = ?").bind(newBalance, exp.imprestId).run();

          // Fetch contact to log name
          const contact = await env.DB.prepare("SELECT * FROM contacts WHERE id = ?").bind(fund.contact_id).first();

          // Log in main transactions ledger
          const txId = "t_im_exp_" + Date.now();
          await env.DB.prepare(`
            INSERT INTO transactions (id, company_id, project_id, type, category, sub_category, amount, account_id, person_name, date, description, is_non_cash, attachment_name)
            VALUES (?, 'c1', ?, 'expense', 'هزینه تنخواه', ?, ?, 'a3', ?, ?, ?, 0, ?)
          `).bind(
            txId,
            fund.project_id,
            exp.materialCategory || "سایر",
            expAmount,
            contact ? contact.name : "تنخواه‌دار",
            exp.expenseDate || "1403/04/03",
            `[هزینه تنخواه‌گردان] ${exp.description}`,
            exp.attachmentName || null
          ).run();
        }

        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      // 9e. Create Pre-Sale Contract
      if (path === "/api/presales" && method === "POST") {
        const presale = await request.json();
        const id = "ps_" + Date.now();
        const totalPrice = Number(presale.totalPrice || (presale.contractArea * presale.pricePerMeter));
        const downPayment = Math.round(totalPrice * 0.30);

        // 1. Save Pre-sale
        await env.DB.prepare(`
          INSERT INTO pre_sales (id, project_id, contact_id, unit_id, contract_area, price_per_meter, total_price, contract_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `).bind(
          id,
          presale.projectId,
          presale.contactId,
          presale.unitId,
          Number(presale.contractArea),
          Number(presale.pricePerMeter),
          totalPrice,
          presale.contractDate || "1403/04/03"
        ).run();

        // 2. Update associated unit status
        const buyer = await env.DB.prepare("SELECT * FROM contacts WHERE id = ?").bind(presale.contactId).first();
        const buyerName = buyer ? buyer.name : "پیش‌خریدار";

        await env.DB.prepare(`
          UPDATE units SET status = 'pre_sold', buyer_name = ?, down_payment = ? WHERE id = ?
        `).bind(buyerName, downPayment, presale.unitId).run();

        // 3. Generate 7-stage standard installment schedule
        const currentMs = Date.now();
        const installments = [
          { name: "پیش‌پرداخت (عقد قرارداد)", dueDate: presale.contractDate, amount: downPayment, isPaid: 1, paidDate: presale.contractDate },
          { name: "پایان پی‌ریزی و فونداسیون", dueDate: "1403/06/15", amount: Math.round(totalPrice * 0.10), isPaid: 0, paidDate: null },
          { name: "پایان اسکلت و سازه", dueDate: "1403/09/01", amount: Math.round(totalPrice * 0.15), isPaid: 0, paidDate: null },
          { name: "پایان سفت‌کاری و دیوارچینی", dueDate: "1403/11/15", amount: Math.round(totalPrice * 0.15), isPaid: 0, paidDate: null },
          { name: "پایان نازک‌کاری و نصبیات", dueDate: "1404/02/20", amount: Math.round(totalPrice * 0.10), isPaid: 0, paidDate: null },
          { name: "تحویل فیزیکی واحد مسکونی", dueDate: "1404/04/01", amount: Math.round(totalPrice * 0.05), isPaid: 0, paidDate: null },
          { name: "تنظیم سند رسمی انتقال در دفترخانه", dueDate: "1404/06/10", amount: Math.round(totalPrice * 0.10), isPaid: 0, paidDate: null }
        ];

        for (let i = 0; i < installments.length; i++) {
          const inst = installments[i];
          const instId = `psi_${i + 1}_${currentMs}`;
          await env.DB.prepare(`
            INSERT INTO pre_sale_installments (id, pre_sale_id, installment_name, due_date, amount, is_paid, paid_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            instId,
            id,
            inst.name,
            inst.dueDate,
            inst.amount,
            inst.isPaid,
            inst.paidDate
          ).run();
        }

        // 4. Log downpayment transaction
        const txId = "t_ps_down_" + currentMs;
        await env.DB.prepare(`
          INSERT INTO transactions (id, company_id, project_id, type, category, amount, account_id, person_name, date, description, is_non_cash)
          VALUES (?, 'c1', ?, 'income', 'پیش‌فروش', ?, 'a1', ?, ?, 'پیش‌دریافت پیش‌پرداخت قرارداد پیش‌فروش واحد', 0)
        `).bind(
          txId,
          presale.projectId,
          downPayment,
          buyerName,
          presale.contractDate || "1403/04/03"
        ).run();

        // 5. Update buyer contact balance
        if (buyer) {
          const newBuyerBalance = (Number(buyer.balance || 0) + totalPrice) - downPayment;
          await env.DB.prepare("UPDATE contacts SET balance = ? WHERE id = ?").bind(newBuyerBalance, presale.contactId).run();
        }

        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      // 9f. Pay Pre-Sale Installment
      if (path === "/api/presales/installments/pay" && method === "POST") {
        const body = await request.json();
        const { installmentId, accountId, paidDate } = body;

        const inst = await env.DB.prepare("SELECT * FROM pre_sale_installments WHERE id = ?").bind(installmentId).first();
        if (!inst) {
          return new Response(JSON.stringify({ error: "قسط مورد نظر یافت نشد" }), { status: 404, headers: corsHeaders });
        }
        if (inst.is_paid === 1) {
          return new Response(JSON.stringify({ error: "این قسط قبلاً پرداخت شده است" }), { status: 400, headers: corsHeaders });
        }

        const datePaid = paidDate || "1403/04/03";

        // Mark paid
        await env.DB.prepare("UPDATE pre_sale_installments SET is_paid = 1, paid_date = ? WHERE id = ?")
          .bind(datePaid, installmentId)
          .run();

        // Find associated presale
        const presale = await env.DB.prepare("SELECT * FROM pre_sales WHERE id = ?").bind(inst.pre_sale_id).first();
        if (presale) {
          const buyer = await env.DB.prepare("SELECT * FROM contacts WHERE id = ?").bind(presale.contact_id).first();
          const unit = await env.DB.prepare("SELECT * FROM units WHERE id = ?").bind(presale.unit_id).first();
          const buyerName = buyer ? buyer.name : "پیش‌خریدار";
          const unitNo = unit ? unit.unit_number : "";

          // Record main transaction ledger
          const txId = "t_ps_inst_" + Date.now();
          const accId = accountId || "a1";
          await env.DB.prepare(`
            INSERT INTO transactions (id, company_id, project_id, type, category, amount, account_id, person_name, date, description, is_non_cash)
            VALUES (?, 'c1', ?, 'income', 'پیش‌فروش', ?, ?, ?, ?, ?, 0)
          `).bind(
            txId,
            presale.project_id,
            Number(inst.amount),
            accId,
            buyerName,
            datePaid,
            `دریافت قسط "${inst.installment_name}" قرارداد پیش‌فروش واحد ${unitNo}`
          ).run();

          // Update bank account balance
          await env.DB.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?")
            .bind(Number(inst.amount), accId)
            .run();

          // Update buyer contact balance
          if (buyer) {
            const newBuyerBal = Math.max(0, Number(buyer.balance || 0) - Number(inst.amount));
            await env.DB.prepare("UPDATE contacts SET balance = ? WHERE id = ?").bind(newBuyerBal, presale.contact_id).run();
          }
        }

        return new Response(JSON.stringify({ status: "success" }), { headers: corsHeaders });
      }

      // 9g. Record SMS Alert
      if (path === "/api/alerts" && method === "POST") {
        const alert = await request.json();
        const id = "al_" + Date.now();

        await env.DB.prepare(`
          INSERT INTO alerts_log (id, type, reference_id, recipient_phone, message, send_date, is_sent)
          VALUES (?, ?, ?, ?, ?, '1403/04/03', 1)
        `).bind(
          id,
          alert.type || "installment",
          alert.referenceId || "",
          alert.recipientPhone || "",
          alert.message || ""
        ).run();

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
