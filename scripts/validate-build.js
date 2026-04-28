#!/usr/bin/env node
/**
 * Validate built HTML file for JSX structure issues
 * This catches errors that unit tests miss because they test individual files,
 * but the build concatenates everything and Babel parses it differently.
 */

const fs = require('fs');

const file = process.argv[2] || 'dist/class-list-optimizer-v1.5.0.html';

if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const content = fs.readFileSync(file, 'utf8');

// Find the babel script section
const babelMatch = content.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if (!babelMatch) {
  console.error('No Babel script found in HTML');
  process.exit(1);
}

const babelScript = babelMatch[1];

console.log('Checking JSX structure...\n');

// Count opening and closing tags for common elements
const tags = ['div', 'Modal', 'span', 'button', 'p', 'h3', 'h4', 'h5'];
let hasError = false;

tags.forEach(tag => {
  const openRegex = new RegExp(`<${tag}\\b`, 'g');
  const closeRegex = new RegExp(`</${tag}>`, 'g');
  
  const opens = (babelScript.match(openRegex) || []).length;
  const closes = (babelScript.match(closeRegex) || []).length;
  
  if (opens !== closes) {
    console.error(`❌ ${tag}: ${opens} opening, ${closes} closing (mismatch!)`);
    hasError = true;
  } else {
    console.log(`✓ ${tag}: ${opens} opening, ${closes} closing`);
  }
});

// Check for fragment balance
const fragments = (babelScript.match(/<>/g) || []).length;
const fragmentCloses = (babelScript.match(/<\/>/g) || []).length;

if (fragments !== fragmentCloses) {
  console.error(`❌ Fragment: ${fragments} opening, ${fragmentCloses} closing (mismatch!)`);
  hasError = true;
} else {
  console.log(`✓ Fragment: ${fragments} opening, ${fragmentCloses} closing`);
}

// Check for common JSX errors
const errors = [];

// Check for unclosed tags followed by unexpected content
const lines = babelScript.split('\n');
lines.forEach((line, idx) => {
  // Check for multiple root elements (adjacent JSX without fragment)
  if (line.match(/^\s*<[A-Z][a-zA-Z]*/)) {
    const prevLine = lines[idx - 1] || '';
    if (prevLine.match(/^\s*<\/[a-zA-Z]+>/)) {
      errors.push(`Line ${idx + 1}: Possible adjacent JSX element after closing tag`);
    }
  }
});

if (errors.length > 0) {
  console.error('\nPotential issues:');
  errors.slice(0, 10).forEach(err => console.error(`  ${err}`));
  hasError = true;
}

if (hasError) {
  console.error('\n❌ Validation failed');
  process.exit(1);
} else {
  console.log('\n✅ JSX structure looks valid');
  process.exit(0);
}
