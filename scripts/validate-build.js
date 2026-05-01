#!/usr/bin/env node
/**
 * Validate built HTML file for JSX structure issues.
 *
 * Parses the inlined Babel script with acorn-jsx so self-closing tags,
 * expression containers, and string content are all handled correctly —
 * unlike a regex tag-counting heuristic, which produced false positives.
 */

const fs = require('fs');
const acorn = require('acorn');
const acornJsx = require('acorn-jsx');

const Parser = acorn.Parser.extend(acornJsx());

const file = process.argv[2] || 'dist/class-list-builder-v1.5.0.html';

if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const content = fs.readFileSync(file, 'utf8');

const babelMatch = content.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if (!babelMatch) {
  console.error('No Babel script found in HTML');
  process.exit(1);
}

const babelScript = babelMatch[1];

console.log('Parsing JSX...\n');

try {
  Parser.parse(babelScript, { ecmaVersion: 2022, sourceType: 'script' });
  console.log('✅ JSX parsed successfully');
  process.exit(0);
} catch (err) {
  console.error(`❌ JSX parse error: ${err.message}`);
  if (err.loc) {
    const lines = babelScript.split('\n');
    const start = Math.max(0, err.loc.line - 4);
    const end = Math.min(lines.length, err.loc.line + 3);
    console.error('\nContext:');
    for (let i = start; i < end; i++) {
      const marker = i + 1 === err.loc.line ? '>>' : '  ';
      console.error(`  ${marker} ${String(i + 1).padStart(5)} | ${lines[i]}`);
    }
  }
  process.exit(1);
}
