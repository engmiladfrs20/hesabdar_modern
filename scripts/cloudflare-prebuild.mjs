#!/usr/bin/env node
/**
 * Pre-build hook for Wrangler (`[build] command = "node scripts/cloudflare-prebuild.mjs"`)
 * Ensures frontend assets are built into ./dist and removes any local server bundles.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const distIndex = path.join(process.cwd(), "dist", "index.html");

if (process.env.CF_DEPLOY_WRAPPER_ACTIVE === "1" && fs.existsSync(distIndex)) {
  console.log("✅ [prebuild] Frontend assets already built in ./dist");
} else {
  console.log("📦 [prebuild] Building frontend assets with Vite...");
  execSync("npx vite build", { stdio: "inherit" });
}

for (const file of ["server.cjs", "server.cjs.map"]) {
  const target = path.join(process.cwd(), "dist", file);
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
  }
}
