#!/usr/bin/env node
// Proof of Life: release gate. `npm publish` runs it (prepublishOnly) and it
// fails while the telemetry collector URL is not set, so a launch build can
// never ship that sends nothing even for people who said yes.
// Also checks package.json and .claude-plugin/plugin.json carry the same version.
//
//   node scripts/check-release.mjs     (or: npm run check-release)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { TELEMETRY_URL } = createRequire(import.meta.url)('../telemetry.js');
const problems = [];

let u = null;
try { u = new URL(String(TELEMETRY_URL || '').trim()); } catch {}
if (!TELEMETRY_URL) problems.push('TELEMETRY_URL in telemetry.js is empty: deploy the collector (collector/DEPLOY.md) and paste its /v1/heartbeat URL first.');
else if (!u || u.protocol !== 'https:' || !/\/v1\/heartbeat$/.test(u.pathname)) problems.push(`TELEMETRY_URL must be the collector's https .../v1/heartbeat URL, got: ${TELEMETRY_URL}`);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const plug = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8')).version;
if (pkg !== plug) problems.push(`version mismatch: package.json ${pkg}, .claude-plugin/plugin.json ${plug}`);

if (problems.length) {
  console.error('Not ready to publish:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}
console.log(`Ready to publish ${pkg}. Heartbeats go to ${TELEMETRY_URL}`);
