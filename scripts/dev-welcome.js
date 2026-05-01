#!/usr/bin/env node
/**
 * Development server with welcome modal enabled
 *
 * Starts the dev server and provides the URL with ?welcome=1 parameter
 * to force the welcome modal to display for testing.
 */

const { spawn } = require('child_process');
const os = require('os');

const PORT = 3000;
const URL = `http://localhost:${PORT}/class-list-builder-source.html?welcome=1`;

console.log('\n' + '='.repeat(60));
console.log('  Class List Builder - Dev Server (Welcome Mode)');
console.log('='.repeat(60) + '\n');

console.log('Starting development server...\n');

// Start serve
const server = spawn('npx', ['--yes', 'serve', '-l', PORT.toString(), '.'], {
  stdio: 'pipe',
  shell: true
});

// Wait a moment for server to start, then show URL
setTimeout(() => {
  console.log('\n' + '='.repeat(60));
  console.log('  Server running! Open this URL to test the welcome modal:');
  console.log('');
  console.log('  ' + URL);
  console.log('');
  console.log('  (The ?welcome=1 parameter forces the modal to display)');
  console.log('='.repeat(60) + '\n');
}, 1500);

// Forward server output
server.stdout.on('data', (data) => {
  process.stdout.write(data);
});

server.stderr.on('data', (data) => {
  process.stderr.write(data);
});

server.on('close', (code) => {
  console.log(`\nServer exited with code ${code}`);
  process.exit(code);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\nShutting down server...');
  server.kill('SIGINT');
});
