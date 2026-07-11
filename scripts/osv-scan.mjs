#!/usr/bin/env node
/**
 * Scan yarn.lock against the OSV.dev vulnerability database — the same data source the
 * Grafana plugin validator's osv-scanner uses.
 *
 * Usage:
 *   yarn audit:osv            fail (exit 1) on HIGH or CRITICAL advisories
 *   yarn audit:osv --strict   fail on any advisory
 *
 * No dependencies; requires Node >= 18 (global fetch).
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const LOCKFILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'yarn.lock');
const OSV_BATCH = 'https://api.osv.dev/v1/querybatch';
const OSV_VULN = 'https://api.osv.dev/v1/vulns/';
const CHUNK_SIZE = 500;
const FAIL_SEVERITIES = process.argv.includes('--strict')
  ? ['LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'UNKNOWN']
  : ['HIGH', 'CRITICAL'];

function parseYarnLock(text) {
  const packages = new Set();
  let name = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('#')) {
      continue;
    }
    // entry header: one or more `name@range` specifiers, not indented
    const header = /^"?(@?[^@"\s]+)@/.exec(line);
    if (header && !line.startsWith(' ')) {
      name = header[1];
      continue;
    }
    const version = /^ {2}version "(.+)"/.exec(line);
    if (version && name) {
      packages.add(`${name}@${version[1]}`);
    }
  }
  return [...packages].sort().map((id) => {
    const at = id.lastIndexOf('@');
    return { name: id.slice(0, at), version: id.slice(at + 1) };
  });
}

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${url} responded ${res.status}`);
  }
  return res.json();
}

async function queryBatch(packages) {
  const hits = [];
  for (let i = 0; i < packages.length; i += CHUNK_SIZE) {
    const chunk = packages.slice(i, i + CHUNK_SIZE);
    const { results } = await post(OSV_BATCH, {
      queries: chunk.map(({ name, version }) => ({ package: { name, ecosystem: 'npm' }, version })),
    });
    results.forEach((result, idx) => {
      for (const vuln of result.vulns ?? []) {
        hits.push({ ...chunk[idx], id: vuln.id });
      }
    });
  }
  return hits;
}

const detailsCache = new Map();
async function vulnDetails(id) {
  if (!detailsCache.has(id)) {
    const res = await fetch(OSV_VULN + id);
    if (!res.ok) {
      throw new Error(`${OSV_VULN}${id} responded ${res.status}`);
    }
    const vuln = await res.json();
    detailsCache.set(id, {
      severity: vuln.database_specific?.severity ?? 'UNKNOWN',
      summary: vuln.summary ?? '',
      fixed: vuln.affected
        ?.flatMap((a) => a.ranges ?? [])
        .flatMap((r) => r.events ?? [])
        .map((e) => e.fixed)
        .filter(Boolean)
        .pop(),
    });
  }
  return detailsCache.get(id);
}

const ORDER = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3, UNKNOWN: 4 };

try {
  const packages = parseYarnLock(await readFile(LOCKFILE, 'utf8'));
  console.log(`Scanning ${packages.length} package versions from yarn.lock against OSV.dev ...\n`);

  const hits = await queryBatch(packages);
  const findings = [];
  for (const hit of hits) {
    findings.push({ ...hit, ...(await vulnDetails(hit.id)) });
  }
  findings.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.name.localeCompare(b.name));

  for (const f of findings) {
    const fix = f.fixed ? ` (fixed in ${f.fixed})` : '';
    console.log(`${f.severity.padEnd(9)} ${f.name}@${f.version}  ${f.id}${fix}`);
    console.log(`          ${f.summary}`);
  }

  const failing = findings.filter((f) => FAIL_SEVERITIES.includes(f.severity));
  console.log(`\n${findings.length} advisories total, ${failing.length} at failing severity (${FAIL_SEVERITIES.join('/')})`);

  if (failing.length > 0) {
    console.error('\nFAIL: resolve the advisories above (yarn "resolutions" pins usually suffice).');
    process.exit(1);
  }
  console.log('OK');
} catch (err) {
  console.error(`osv-scan error: ${err.message}`);
  process.exit(2);
}
