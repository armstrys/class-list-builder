#!/usr/bin/env node
/**
 * Deterministic content hashing for release security audits.
 *
 * Hashes the files an audit makes claims about, so a release audit can be
 * pinned to an exact snapshot of the code, dependencies, and SECURITY.md
 * claims. If any of those drift after the audit is written, verify-audit.js
 * will fail CI.
 *
 * The manifest is a sorted, newline-delimited list of "<relPath>\t<sha256>"
 * entries; the manifest hash is the SHA-256 of that text. Sub-hashes are
 * computed over the same scheme restricted to each component's paths so
 * reviewers can see *which* slice changed.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..');

const COMPONENTS = {
  sources: ['src'],
  deps: ['package.json', 'package-lock.json'],
  claims: ['docs/SECURITY.md'],
  build: [
    'build-standalone.js',
    'class-list-builder-source.html',
    'scripts/validate-build.js',
  ],
};

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.tmp']);

function walk(absPath, acc) {
  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) {
    if (IGNORED_DIRS.has(path.basename(absPath))) return acc;
    for (const entry of fs.readdirSync(absPath).sort()) {
      walk(path.join(absPath, entry), acc);
    }
  } else if (stat.isFile()) {
    acc.push(absPath);
  }
  return acc;
}

function collect(roots) {
  const files = [];
  for (const rel of roots) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) {
      throw new Error(`audit-hash: required path missing: ${rel}`);
    }
    walk(abs, files);
  }
  return files
    .map((abs) => path.relative(repoRoot, abs))
    .filter((rel) => !rel.split(path.sep).some((part) => IGNORED_DIRS.has(part)))
    .sort();
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function manifestFor(relPaths) {
  const lines = relPaths.map((rel) => {
    const buf = fs.readFileSync(path.join(repoRoot, rel));
    return `${rel}\t${sha256(buf)}`;
  });
  const text = lines.join('\n') + '\n';
  return { text, hash: sha256(text) };
}

function computeAll() {
  const componentResults = {};
  const everyPath = new Set();
  for (const [name, roots] of Object.entries(COMPONENTS)) {
    const paths = collect(roots);
    paths.forEach((p) => everyPath.add(p));
    componentResults[name] = { paths, ...manifestFor(paths) };
  }
  const allPaths = Array.from(everyPath).sort();
  const overall = manifestFor(allPaths);
  return {
    manifestSha256: overall.hash,
    manifestText: overall.text,
    components: Object.fromEntries(
      Object.entries(componentResults).map(([name, r]) => [
        name,
        { sha256: r.hash, fileCount: r.paths.length },
      ]),
    ),
  };
}

if (require.main === module) {
  const result = computeAll();
  const wantsJson = process.argv.includes('--json');
  const wantsManifest = process.argv.includes('--manifest');
  if (wantsManifest) {
    process.stdout.write(result.manifestText);
  } else if (wantsJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    console.log(`manifest-sha256: sha256:${result.manifestSha256}`);
    for (const [name, info] of Object.entries(result.components)) {
      console.log(`${name}-sha256:    sha256:${info.sha256}  (${info.fileCount} files)`);
    }
  }
}

module.exports = { computeAll };
