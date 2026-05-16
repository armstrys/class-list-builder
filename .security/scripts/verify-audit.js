#!/usr/bin/env node
/**
 * Verify the release audit for the current package.json version.
 *
 * Gates merges to main. Exits 0 on pass, 1 on failure. Run from CI; safe
 * to run locally before opening a release PR.
 *
 * Checks:
 *   1. audits/<version>.md exists
 *   2. Front matter present and parses (minimal YAML subset)
 *   3. Required front-matter keys present and non-empty
 *   4. status is pass|conditional-pass
 *   5. version in front matter equals package.json version
 *   6. Required H2 sections present
 *   7. manifest-sha256 (and component hashes) match the live tree
 *   8. exceptions cited exist in audits/exceptions.json and are unexpired
 *   9. Sign-off line has been filled in (no "PENDING" placeholder)
 */

const fs = require('fs');
const path = require('path');
const { computeAll } = require('./audit-hash');

const repoRoot = path.resolve(__dirname, '../..');
const TODAY = new Date().toISOString().slice(0, 10);

const REQUIRED_FRONTMATTER = [
  'version',
  'audit-date',
  'auditor',
  'manifest-sha256',
  'sources-sha256',
  'deps-sha256',
  'claims-sha256',
  'status',
];

const REQUIRED_SECTIONS = [
  '## Scope',
  '## Methodology',
  '## SECURITY.md Claims Verification',
  '## Vulnerability Findings',
  '## Dependency Audit',
  '## Prompt Injection Defense Notes',
  '## Accepted Risks',
  '## Sign-off',
];

const ALLOWED_STATUSES = new Set(['pass', 'conditional-pass']);

const failures = [];
function fail(msg) {
  failures.push(msg);
}

function parseFrontMatter(text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return null;
  const body = text.slice(4, end);
  const data = {};
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      val = val.replace(/^["']|["']$/g, '');
    }
    data[key] = val;
  }
  return { data, bodyStart: end + 5 };
}

function loadExceptions() {
  const p = path.join(repoRoot, '.security', 'audits', 'exceptions.json');
  if (!fs.existsSync(p)) return new Map();
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    fail(`.security/audits/exceptions.json is not valid JSON: ${e.message}`);
    return new Map();
  }
  const out = new Map();
  for (const ex of parsed.exceptions || []) {
    if (!ex.id) {
      fail(`exception entry missing id: ${JSON.stringify(ex)}`);
      continue;
    }
    out.set(ex.id, ex);
  }
  return out;
}

function main() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
  );
  const version = pkg.version;
  const auditPath = path.join(repoRoot, '.security', 'audits', `${version}.md`);

  console.log(`Verifying audit for version ${version}`);
  console.log(`  audit file: .security/audits/${version}.md`);

  if (!fs.existsSync(auditPath)) {
    fail(
      `Missing .security/audits/${version}.md. Run the security-audit-system skill to produce one before merging.`,
    );
    return finish();
  }

  const raw = fs.readFileSync(auditPath, 'utf8');
  const fm = parseFrontMatter(raw);
  if (!fm) {
    fail('Audit file is missing YAML front matter (--- ... ---).');
    return finish();
  }

  for (const key of REQUIRED_FRONTMATTER) {
    const v = fm.data[key];
    if (v === undefined || v === '' || (typeof v === 'string' && /REPLACE_ME/i.test(v))) {
      fail(`Front matter is missing or unfilled: ${key}`);
    }
  }

  if (fm.data.version && fm.data.version !== version) {
    fail(
      `Front matter version (${fm.data.version}) does not match package.json version (${version}).`,
    );
  }

  if (fm.data.status && !ALLOWED_STATUSES.has(fm.data.status)) {
    fail(
      `Front matter status is "${fm.data.status}"; must be one of: ${[...ALLOWED_STATUSES].join(', ')}.`,
    );
  }

  if (fm.data['audit-date']) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fm.data['audit-date'])) {
      fail(`audit-date must be YYYY-MM-DD, got "${fm.data['audit-date']}".`);
    } else if (fm.data['audit-date'] > TODAY) {
      fail(`audit-date ${fm.data['audit-date']} is in the future.`);
    }
  }

  const body = raw.slice(fm.bodyStart);
  for (const section of REQUIRED_SECTIONS) {
    if (!body.includes(`\n${section}\n`) && !body.startsWith(`${section}\n`)) {
      fail(`Missing required section heading: ${section}`);
    }
  }

  if (/PENDING HUMAN SIGN-OFF/i.test(body)) {
    fail(
      'Sign-off section still contains the "PENDING HUMAN SIGN-OFF" placeholder. The human auditor must replace it before merge.',
    );
  }

  const live = computeAll();
  const checks = [
    ['manifest-sha256', live.manifestSha256],
    ['sources-sha256', live.components.sources.sha256],
    ['deps-sha256', live.components.deps.sha256],
    ['claims-sha256', live.components.claims.sha256],
  ];
  for (const [key, expected] of checks) {
    const claimed = (fm.data[key] || '').replace(/^sha256:/, '');
    if (claimed && claimed !== expected) {
      fail(
        `${key} mismatch.\n    audit:  sha256:${claimed}\n    actual: sha256:${expected}\n    The tree changed since the audit. Re-audit (or revert the drift) before merging.`,
      );
    }
  }

  const exceptionsRegistry = loadExceptions();
  const cited = new Set();
  for (const m of body.matchAll(/CLB-EXC-\d{4,}/g)) cited.add(m[0]);
  const fmCited = Array.isArray(fm.data['exceptions-cited'])
    ? fm.data['exceptions-cited']
    : [];
  for (const id of fmCited) cited.add(id);
  for (const id of cited) {
    const ex = exceptionsRegistry.get(id);
    if (!ex) {
      fail(`Audit cites exception ${id} but it is not in .security/audits/exceptions.json.`);
      continue;
    }
    if (ex.expires && ex.expires < TODAY) {
      fail(`Exception ${id} expired on ${ex.expires} (today is ${TODAY}).`);
    }
  }

  finish();
}

function finish() {
  if (failures.length === 0) {
    console.log('\nAudit verification: PASS');
    process.exit(0);
  }
  console.error('\nAudit verification: FAIL');
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    '\nSee .security/audits/README.md and .claude/skills/security-audit-system/SKILL.md for how to produce a passing audit.',
  );
  process.exit(1);
}

main();
