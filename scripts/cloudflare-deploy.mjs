#!/usr/bin/env node
/**
 * Smart Cloudflare Workers + D1 Auto-Discovery & Deployment Script
 * Automatically discovers the existing D1 database ID from the user's Cloudflare account
 * (or existing Worker bindings, or creates the D1 database if needed), updates wrangler.toml,
 * applies schema.sql, and deploys the Worker + static frontend assets.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";

const WORKER_NAME = process.env.CF_WORKER_NAME || "hesabdarpeymankar";
const DEFAULT_DB_NAME = "hesabdar_peymankar";
const FALLBACK_ACCOUNT_ID = "3c8149ed1add30829dc3267ea56df1d6";
const INVALID_PLACEHOLDER_UUID = "37ff26e8-8d91-421d-bfac-297167ad5d96";

const apiToken = (process.env.CLOUDFLARE_API_TOKEN || "").trim();
let accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();

if (!apiToken) {
  console.log("==================================================================");
  console.log("⚠️ توجه: متغیر CLOUDFLARE_API_TOKEN در بخش Secrets گیت‌هاب تنظیم نشده است.");
  console.log("اگر می‌خواهید انتشار از طریق GitHub Actions انجام شود:");
  console.log("۱. در گیت‌هاب وارد Settings -> Secrets and variables -> Actions شوید.");
  console.log("۲. روی New repository secret کلیک کنید.");
  console.log("۳. نام را CLOUDFLARE_API_TOKEN بگذارید و توکن کلودفلر خود را وارد نمایید.");
  console.log("==================================================================");
  process.exit(0);
}

const headers = {
  "Authorization": `Bearer ${apiToken}`,
  "Content-Type": "application/json"
};

async function cfFetchJson(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {})
      }
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

async function resolveAccountId() {
  if (accountId) return accountId;
  console.log("🔍 Checking Cloudflare Account ID via API...");
  const res = await cfFetchJson("https://api.cloudflare.com/client/v4/accounts?page=1&per_page=10");
  if (res.ok && Array.isArray(res.data?.result) && res.data.result.length > 0) {
    const match = res.data.result.find(a => a.id === FALLBACK_ACCOUNT_ID) || res.data.result[0];
    accountId = match.id;
    console.log(`✅ Found Cloudflare Account ID: ${accountId} (${match.name || "Account"})`);
    return accountId;
  }
  accountId = FALLBACK_ACCOUNT_ID;
  console.log(`ℹ️ Using Cloudflare Account ID: ${accountId}`);
  return accountId;
}

function addCandidate(list, uuid, name, source) {
  if (!uuid || typeof uuid !== "string") return;
  const cleanUuid = uuid.trim();
  if (!cleanUuid || cleanUuid === INVALID_PLACEHOLDER_UUID) return;
  if (!list.some(c => c.uuid === cleanUuid)) {
    console.log(`✅ Discovered D1 candidate [${source}]: name=${name || DEFAULT_DB_NAME}, id=${cleanUuid}`);
    list.push({
      uuid: cleanUuid,
      name: name || DEFAULT_DB_NAME,
      source
    });
  }
}

function extractBindingsFromArray(bindings, list, source) {
  if (!Array.isArray(bindings)) return;
  for (const b of bindings) {
    if (!b || typeof b !== "object") continue;
    if (b.type === "d1" || b.name === "DB" || b.database_id) {
      const id = b.id || b.database_id || b.databaseId;
      const dbName = b.database_name || b.databaseName || DEFAULT_DB_NAME;
      addCandidate(list, id, dbName, source);
    }
  }
}

async function discoverWorkerBoundD1(accId) {
  const candidates = [];

  // 1. Check Worker Settings endpoint
  const settingsRes = await cfFetchJson(
    `https://api.cloudflare.com/client/v4/accounts/${accId}/workers/scripts/${WORKER_NAME}/settings`
  );
  if (settingsRes.ok) {
    extractBindingsFromArray(settingsRes.data?.result?.bindings, candidates, "worker_settings");
  }

  // 2. Check Worker Service production environment bindings
  const envBindingsRes = await cfFetchJson(
    `https://api.cloudflare.com/client/v4/accounts/${accId}/workers/services/${WORKER_NAME}/environments/production/bindings`
  );
  if (envBindingsRes.ok) {
    extractBindingsFromArray(envBindingsRes.data?.result, candidates, "service_bindings");
  }

  // 3. Check Worker Versions endpoint
  const versionsRes = await cfFetchJson(
    `https://api.cloudflare.com/client/v4/accounts/${accId}/workers/scripts/${WORKER_NAME}/versions?page=1&per_page=5`
  );
  const items = versionsRes.data?.result?.items || (Array.isArray(versionsRes.data?.result) ? versionsRes.data.result : []);
  if (versionsRes.ok && Array.isArray(items)) {
    for (const item of items.slice(0, 3)) {
      extractBindingsFromArray(item?.resources?.bindings || item?.bindings, candidates, "worker_versions_list");
      if (item?.id && candidates.length === 0) {
        const verDetailRes = await cfFetchJson(
          `https://api.cloudflare.com/client/v4/accounts/${accId}/workers/scripts/${WORKER_NAME}/versions/${item.id}`
        );
        if (verDetailRes.ok) {
          extractBindingsFromArray(
            verDetailRes.data?.result?.resources?.bindings || verDetailRes.data?.result?.bindings,
            candidates,
            `worker_version_${item.id}`
          );
        }
      }
    }
  }

  return candidates;
}

async function discoverOrCreateAccountD1(accId, workerCandidates = []) {
  const dbList = [];

  // 1. Try Cloudflare REST API for D1
  const listRes = await cfFetchJson(
    `https://api.cloudflare.com/client/v4/accounts/${accId}/d1/database`
  );
  if (listRes.ok && Array.isArray(listRes.data?.result)) {
    for (const db of listRes.data.result) {
      addCandidate(dbList, db.uuid, db.name, "d1_api_list");
    }
    console.log(`📋 Cloudflare D1 API returned ${dbList.length} database(s).`);
  }

  // 2. Also try `npx wrangler d1 list --json`
  if (dbList.length === 0) {
    try {
      const rawOut = execSync("npx wrangler d1 list --json", {
        env: { ...process.env, CLOUDFLARE_API_TOKEN: apiToken, CLOUDFLARE_ACCOUNT_ID: accId },
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"]
      });
      const parsed = JSON.parse(rawOut);
      if (Array.isArray(parsed)) {
        for (const db of parsed) {
          addCandidate(dbList, db.uuid, db.name, "wrangler_d1_list");
        }
        console.log(`📋 Wrangler D1 list returned ${dbList.length} database(s).`);
      }
    } catch {
      // Ignore if token doesn't have D1 list permission
    }
  }

  const ordered = [];

  // A) Any database in dbList that matches the Worker's current bound D1 UUID
  for (const wc of workerCandidates) {
    const verified = dbList.find(d => d.uuid === wc.uuid);
    if (verified) {
      addCandidate(ordered, verified.uuid, verified.name, `${wc.source}+verified`);
    } else {
      addCandidate(ordered, wc.uuid, wc.name, wc.source);
    }
  }

  // B) Preferred names in dbList
  const preferredNames = [
    DEFAULT_DB_NAME,
    "construction-accounting-db",
    "CONSTRUCTION_ACCOUNTING_D1",
    "hesabdarpeymankar"
  ];
  for (const pref of preferredNames) {
    const found = dbList.find(d => d.name.toLowerCase() === pref.toLowerCase());
    if (found) {
      addCandidate(ordered, found.uuid, found.name, "preferred_name");
    }
  }

  // C) Any other D1 database in the account
  for (const d of dbList) {
    addCandidate(ordered, d.uuid, d.name, d.source);
  }

  // D) If no D1 database exists yet, try creating one via API or Wrangler CLI
  if (ordered.length === 0) {
    console.log(`🔨 No existing D1 database found. Attempting to create '${DEFAULT_DB_NAME}'...`);
    const createRes = await cfFetchJson(
      `https://api.cloudflare.com/client/v4/accounts/${accId}/d1/database`,
      {
        method: "POST",
        body: JSON.stringify({ name: DEFAULT_DB_NAME })
      }
    );
    if (createRes.ok && createRes.data?.result?.uuid) {
      addCandidate(
        ordered,
        createRes.data.result.uuid,
        createRes.data.result.name || DEFAULT_DB_NAME,
        "d1_api_create"
      );
    } else {
      try {
        const createOut = execSync(`npx wrangler d1 create ${DEFAULT_DB_NAME}`, {
          env: { ...process.env, CLOUDFLARE_API_TOKEN: apiToken, CLOUDFLARE_ACCOUNT_ID: accId },
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "pipe"]
        });
        const uuidMatch = createOut.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (uuidMatch) {
          addCandidate(ordered, uuidMatch[0], DEFAULT_DB_NAME, "wrangler_d1_create");
        }
      } catch {
        console.log(`ℹ️ Could not auto-create D1 database (token may lack D1:Edit permission).`);
      }
    }
  }

  return ordered;
}

function generateWranglerToml({ dbName, dbUuid, includeD1 = true }) {
  let content = `# wrangler.toml - Cloudflare Workers & D1 Configuration
# Generated by AI Studio Construction Accounting Suite

name = "${WORKER_NAME}"
main = "worker.js"
compatibility_date = "2024-03-01"

[vars]
BACKUP_SECRET_TOKEN = "secure_random_token_here"

[assets]
directory = "./dist"
binding = "ASSETS"
`;

  if (includeD1 && dbUuid) {
    content += `
[[d1_databases]]
binding = "DB"
database_name = "${dbName || DEFAULT_DB_NAME}"
database_id = "${dbUuid}"
`;
  }

  return content;
}

function ensureFrontendDistBuilt() {
  const distIndex = path.join(process.cwd(), "dist", "index.html");
  if (!fs.existsSync(distIndex)) {
    console.log("📦 Building frontend assets with Vite...");
    execSync("npx vite build", { stdio: "inherit" });
  } else {
    console.log("✅ Frontend assets (./dist/index.html) ready.");
  }
  for (const f of ["server.cjs", "server.cjs.map"]) {
    const p = path.join(process.cwd(), "dist", f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

function runWranglerDeploy(accId) {
  const env = {
    ...process.env,
    CF_DEPLOY_WRAPPER_ACTIVE: "1",
    CLOUDFLARE_API_TOKEN: apiToken,
    ...(accId ? { CLOUDFLARE_ACCOUNT_ID: accId } : {})
  };
  const result = spawnSync("npx", ["wrangler", "deploy", "--keep-vars"], {
    cwd: process.cwd(),
    env,
    encoding: "utf-8"
  });
  const combinedOutput = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return {
    status: result.status ?? 1,
    output: combinedOutput
  };
}

async function main() {
  ensureFrontendDistBuilt();
  const accId = await resolveAccountId();

  const workerCandidates = await discoverWorkerBoundD1(accId);
  const candidates = await discoverOrCreateAccountD1(accId, workerCandidates);

  const wranglerPath = path.join(process.cwd(), "wrangler.toml");

  // Try deploying with each discovered D1 candidate
  for (const candidate of candidates) {
    console.log(`\n🚀 Attempting deployment with D1 database '${candidate.name}' (${candidate.uuid}) [source: ${candidate.source}]...`);
    fs.writeFileSync(
      wranglerPath,
      generateWranglerToml({ dbName: candidate.name, dbUuid: candidate.uuid, includeD1: true }),
      "utf-8"
    );

    try {
      console.log(`📂 Applying schema.sql to D1 database '${candidate.name}'...`);
      execSync(`npx wrangler d1 execute ${candidate.name} --remote --file=schema.sql`, {
        env: { ...process.env, CLOUDFLARE_API_TOKEN: apiToken, CLOUDFLARE_ACCOUNT_ID: accId },
        stdio: "inherit"
      });
    } catch {
      console.log(`ℹ️ Skipping CLI schema migration (worker.js will auto-verify tables on runtime).`);
    }

    const deployRes = runWranglerDeploy(accId);
    if (deployRes.status === 0) {
      console.log("\n✅ Cloudflare Worker + Frontend Assets + D1 Database deployed successfully!");
      process.exit(0);
    }

    console.warn(`⚠️ Deployment with D1 candidate ${candidate.uuid} did not succeed. Trying next option...`);
  }

  // If no D1 candidates worked, try creating a fresh D1 database via Wrangler CLI
  console.log("\n🔄 Attempting to create a new D1 database via Wrangler CLI...");
  try {
    const createOut = execSync(`npx wrangler d1 create ${DEFAULT_DB_NAME}`, {
      env: { ...process.env, CLOUDFLARE_API_TOKEN: apiToken, CLOUDFLARE_ACCOUNT_ID: accId },
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const uuidMatch = createOut.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch && uuidMatch[0] !== INVALID_PLACEHOLDER_UUID) {
      const newUuid = uuidMatch[0];
      console.log(`✅ Created D1 database '${DEFAULT_DB_NAME}' (${newUuid}). Deploying...`);
      fs.writeFileSync(
        wranglerPath,
        generateWranglerToml({ dbName: DEFAULT_DB_NAME, dbUuid: newUuid, includeD1: true }),
        "utf-8"
      );
      try {
        execSync(`npx wrangler d1 execute ${DEFAULT_DB_NAME} --remote --file=schema.sql`, {
          env: { ...process.env, CLOUDFLARE_API_TOKEN: apiToken, CLOUDFLARE_ACCOUNT_ID: accId },
          stdio: "inherit"
        });
      } catch {}
      const retryRes = runWranglerDeploy(accId);
      if (retryRes.status === 0) {
        console.log("\n✅ Cloudflare Worker + D1 deployed successfully!");
        process.exit(0);
      }
    }
  } catch {
    // Proceed to fallback
  }

  // Final Fallback: Deploy Worker + Static Assets without hardcoded D1 UUID in wrangler.toml
  console.log("\n⚠️ Deploying Worker and Static Frontend Assets without static D1 UUID in wrangler.toml...");
  fs.writeFileSync(
    wranglerPath,
    generateWranglerToml({ includeD1: false }),
    "utf-8"
  );
  const fallbackRes = runWranglerDeploy(accId);
  if (fallbackRes.status === 0) {
    console.log("\n✅ Cloudflare Worker + Static Assets deployed successfully!");
    process.exit(0);
  }

  process.exit(fallbackRes.status);
}

main().catch(err => {
  console.error("❌ Deployment script error:", err);
  process.exit(1);
});
