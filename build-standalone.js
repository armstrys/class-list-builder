#!/usr/bin/env node
/**
 * Build standalone HTML file by inlining external CDN resources
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SOURCE_FILE = 'class-list-optimizer-source.html';
const OUTPUT_DIR = 'dist';

// CDN resources to inline
const RESOURCES = {
  'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap': { type: 'css' },
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': { type: 'js' },
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': { type: 'js' },
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js': { type: 'js' },
};

// Fetch a URL and return the content as a Buffer (binary-safe)
function fetchUrl(url, redirectDepth = 0) {
  if (redirectDepth > 5) return Promise.reject(new Error(`Too many redirects for ${url}`));
  return new Promise((resolve, reject) => {
    console.log(`Fetching: ${url}`);
    const req = https.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirects
        console.log(`  Redirecting to: ${res.headers.location}`);
        fetchUrl(res.headers.location, redirectDepth + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

// Fetch Google Fonts CSS and inline the font files
async function inlineGoogleFonts(cssBuffer) {
  const cssContent = cssBuffer.toString('utf8');
  // Find all font URLs in the CSS
  const urlRegex = /url\((https:\/\/[^)]+)\)/g;
  const urls = [];
  let match;
  while ((match = urlRegex.exec(cssContent)) !== null) {
    urls.push(match[1]);
  }

  // Fetch each font file and convert to data URI (binary-safe via Buffer)
  const fontDataMap = new Map();
  for (const url of urls) {
    try {
      const data = await fetchUrl(url);
      const base64 = data.toString('base64');
      const contentType = url.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream';
      const dataUri = `data:${contentType};base64,${base64}`;
      fontDataMap.set(url, dataUri);
      console.log(`  Inlined font: ${url.split('/').pop()}`);
    } catch (err) {
      console.error(`  Warning: Could not fetch font ${url}:`, err.message);
    }
  }

  // Replace URLs with data URIs
  let result = cssContent;
  for (const [url, dataUri] of fontDataMap) {
    result = result.split(url).join(dataUri);
  }

  return result;
}

// Main build function
async function build() {
  try {
    // Read version from package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const version = packageJson.version;

    // Read source HTML
    console.log(`Reading source file: ${SOURCE_FILE}`);
    let html = fs.readFileSync(SOURCE_FILE, 'utf8');

    // Fetch and inline each resource
    for (const [url, info] of Object.entries(RESOURCES)) {
      try {
        let contentBuffer = await fetchUrl(url);

        // For Google Fonts, also inline the font files
        let textContent;
        if (url.includes('fonts.googleapis.com')) {
          textContent = await inlineGoogleFonts(contentBuffer);
        } else {
          textContent = contentBuffer.toString('utf8');
        }

        if (!textContent.length) throw new Error('Empty response body');

        // Create inline tag
        let inlineTag;
        const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (info.type === 'css') {
          inlineTag = `<style>/* Inlined from ${url} */\n${textContent}</style>`;
        } else {
          inlineTag = `<script>/* Inlined from ${url} */\n${textContent}<\/script>`;
        }

        // Replace the external reference with inline content.
        // For JS, match the full <script src="..."></script> (including closing tag)
        // to avoid leaving orphan </script> tokens in the document.
        if (info.type === 'css') {
          html = html.replace(
            new RegExp(`<link[^>]*href="${escaped}"[^>]*>`, 'i'),
            () => inlineTag
          );
        } else {
          html = html.replace(
            new RegExp(`<script[^>]*src="${escaped}"[^>]*><\\/script>`, 'i'),
            () => inlineTag
          );
        }

        console.log(`  Inlined: ${url}`);
      } catch (err) {
        console.error(`  Error fetching ${url}:`, err.message);
        process.exit(1);
      }
    }

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Write output file
    const outputFile = path.join(OUTPUT_DIR, `class-list-optimizer-v${version}.html`);
    fs.writeFileSync(outputFile, html);

    console.log(`\n✅ Build complete: ${outputFile}`);
    console.log(`   Size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);

  } catch (err) {
    console.error('Build failed:', err.message);
    process.exit(1);
  }
}

build();
