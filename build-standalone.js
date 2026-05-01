#!/usr/bin/env node
/**
 * Build standalone HTML file by inlining local source files and external CDN resources.
 *
 * Step 1: Inline `<link rel="stylesheet" href="src/...">` tags as `<style>` blocks.
 * Step 2: Concatenate all `<script type="text/babel" src="src/...">` tags into one
 *         inline `<script type="text/babel">` (preserving load order).
 * Step 3: Inline CDN-hosted CSS, JS, and Google Fonts as data URIs.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const SOURCE_FILE = 'class-list-builder-source.html';
const OUTPUT_DIR = 'dist';

// Size thresholds for warnings
const SIZE_THRESHOLDS = {
  WARN_MB: 3.0,    // Yellow warning at 3MB
  ERROR_MB: 5.0,   // Red error at 5MB
};

/**
 * Format bytes to human-readable string
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get gzip size estimate for a buffer
 * @param {Buffer} buffer
 * @returns {number}
 */
function getGzipSize(buffer) {
  return zlib.gzipSync(buffer).length;
}

/**
 * Display bundle size report with warnings
 * @param {string} outputFile
 */
function displayBundleReport(outputFile) {
  const stats = fs.statSync(outputFile);
  const content = fs.readFileSync(outputFile);
  const gzipSize = getGzipSize(content);
  const sizeMB = stats.size / 1024 / 1024;

  console.log('\n' + '═'.repeat(60));
  console.log('📦 Bundle Size Report');
  console.log('═'.repeat(60));
  console.log(`   Original: ${formatBytes(stats.size)}`);
  console.log(`   Gzipped:  ${formatBytes(gzipSize)} (~${((gzipSize / stats.size) * 100).toFixed(1)}% of original)`);
  console.log('─'.repeat(60));

  // Warning levels
  if (sizeMB >= SIZE_THRESHOLDS.ERROR_MB) {
    console.log(`   ⚠️  CRITICAL: Bundle exceeds ${SIZE_THRESHOLDS.ERROR_MB}MB threshold`);
    console.log(`      Consider code splitting or lazy loading`);
  } else if (sizeMB >= SIZE_THRESHOLDS.WARN_MB) {
    console.log(`   ⚠️  WARNING: Bundle exceeds ${SIZE_THRESHOLDS.WARN_MB}MB threshold`);
    console.log(`      Monitor size growth carefully`);
  } else {
    console.log(`   ✅ Bundle size is healthy`);
  }

  // Calculate breakdown
  const htmlSize = content.toString().length;
  const scriptMatches = content.toString().match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  const styleMatches = content.toString().match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];

  let scriptSize = 0;
  scriptMatches.forEach(match => {
    scriptSize += match.length;
  });

  let styleSize = 0;
  styleMatches.forEach(match => {
    styleSize += match.length;
  });

  console.log('\n   Breakdown:');
  console.log(`      Scripts: ${formatBytes(scriptSize)} (${((scriptSize / htmlSize) * 100).toFixed(1)}%)`);
  console.log(`      Styles:  ${formatBytes(styleSize)} (${((styleSize / htmlSize) * 100).toFixed(1)}%)`);
  console.log(`      HTML:    ${formatBytes(htmlSize - scriptSize - styleSize)} (${(((htmlSize - scriptSize - styleSize) / htmlSize) * 100).toFixed(1)}%)`);
  console.log('═'.repeat(60));
}

/**
 * Analyze source files for code quality metrics
 */
function analyzeSourceFiles() {
  console.log('\n🔍 Analyzing source files...\n');

  const srcDir = path.join(__dirname, 'src');
  const componentsDir = path.join(srcDir, 'components');
  const files = [];

  // Collect all JS files
  function collectFiles(dir, prefix = '') {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        collectFiles(fullPath, path.join(prefix, item));
      } else if (item.endsWith('.js')) {
        files.push({
          path: fullPath,
          relative: path.join(prefix, item),
          size: stat.size,
          lines: fs.readFileSync(fullPath, 'utf8').split('\n').length
        });
      }
    });
  }

  collectFiles(srcDir);

  // Sort by line count
  files.sort((a, b) => b.lines - a.lines);

  console.log('   File                          Lines    Size');
  console.log('   ' + '─'.repeat(55));

  let oversizedCount = 0;
  files.forEach(file => {
    const sizeStr = formatBytes(file.size).padStart(10);
    const linesStr = file.lines.toString().padStart(6);
    const status = file.lines > 300 ? ' ⚠️' : file.lines > 200 ? ' ⚡' : '  ';
    if (file.lines > 300) oversizedCount++;
    console.log(`   ${status} ${file.relative.padEnd(28)} ${linesStr} ${sizeStr}`);
  });

  console.log('   ' + '─'.repeat(55));

  if (oversizedCount > 0) {
    console.log(`   ⚠️  ${oversizedCount} file(s) exceed 300 lines (recommend < 200)`);
  } else {
    console.log('   ✅ All files under 300 lines');
  }

  return files;
}

// CDN resources to inline
const RESOURCES = {
  'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap': { type: 'css' },
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': { type: 'js' },
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': { type: 'js' },
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js': { type: 'js' },
};

// Inline local <link rel="stylesheet" href="src/..."> tags
function inlineLocalStyles(html) {
  // Match <link ... rel="stylesheet" ... href="src/..."> in any attribute order
  const regex = /<link\b[^>]*rel="stylesheet"[^>]*href="(src\/[^"]+)"[^>]*>|<link\b[^>]*href="(src\/[^"]+)"[^>]*rel="stylesheet"[^>]*>/gi;
  return html.replace(regex, (match, href1, href2) => {
    const href = href1 || href2;
    const filePath = path.resolve(href);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Local stylesheet not found: ${href}`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`  Inlined local CSS: ${href}`);
    return `<style>/* Inlined from ${href} */\n${content}</style>`;
  });
}

// Concatenate local <script type="text/babel" src="src/..."> tags into one inline block
function inlineLocalScripts(html) {
  const regex = /[ \t]*<script\b[^>]*type="text\/babel"[^>]*src="(src\/[^"]+)"[^>]*><\/script>\n?/gi;
  const sources = [];
  html = html.replace(regex, (_match, src) => {
    sources.push(src);
    return '';  // remove individual tag
  });

  if (!sources.length) return html;

  const concatenated = sources.map(src => {
    const filePath = path.resolve(src);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Local script not found: ${src}`);
    }
    const body = fs.readFileSync(filePath, 'utf8');
    console.log(`  Inlined local JS:  ${src}`);
    return `// ─── ${src} ───\n${body}`;
  }).join('\n');

  // Insert the combined block where the first <script src="src/..."> was
  // (we removed all of them, so append before </body>)
  const inlineBlock = `<script type="text/babel">\n${concatenated}\n</script>`;
  if (html.includes('</body>')) {
    return html.replace('</body>', `${inlineBlock}\n</body>`);
  }
  return html + '\n' + inlineBlock;
}

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
  const startTime = Date.now();

  try {
    // Analyze source files first
    analyzeSourceFiles();

    // Read version from package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const version = packageJson.version;

    console.log(`\n📄 Reading source file: ${SOURCE_FILE}`);
    let html = fs.readFileSync(SOURCE_FILE, 'utf8');

    // Inline local sources (CSS + JS) before fetching CDN resources
    console.log('\n📝 Inlining local source files…');
    html = inlineLocalStyles(html);
    html = inlineLocalScripts(html);

    // Fetch and inline each resource
    console.log('\n🌐 Fetching CDN resources…');
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

        console.log(`  ✅ Inlined: ${url.split('/').pop()}`);
      } catch (err) {
        console.error(`  ❌ Error fetching ${url}:`, err.message);
        process.exit(1);
      }
    }

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Write output file
    const outputFile = path.join(OUTPUT_DIR, `class-list-builder-v${version}.html`);
    fs.writeFileSync(outputFile, html);

    // Display comprehensive report
    const duration = Date.now() - startTime;
    console.log(`\n✅ Build complete in ${duration}ms`);
    console.log(`   Output: ${outputFile}`);

    displayBundleReport(outputFile);

    console.log('\n💡 Next steps:');
    console.log('   • Run tests: npm test');
    console.log('   • Run lint: npm run lint (after: npm install eslint)');

  } catch (err) {
    console.error('\n❌ Build failed:', err.message);
    process.exit(1);
  }
}

build();
