import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Shipped code must not write debug output to the console.
 *
 * `console.warn` / `console.error` are deliberate and stay: they surface a
 * criterion that cannot be optimised and an assessment that disagrees with
 * itself, both of which are worth seeing. `console.log` has no such job in a
 * static, offline tool — and large rosters, the one place a support
 * conversation asks a teacher to open the console, were the case that printed
 * it. #109.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const sourceFiles = readdirSync(root, { recursive: true })
  .map(entry => String(entry))
  .filter(rel => rel.endsWith('.js'));

describe('shipped source', () => {
  test('has at least the modules we expect, so the sweep is not vacuous', () => {
    expect(sourceFiles).toContain('optimizer.js');
    expect(sourceFiles.length).toBeGreaterThan(5);
  });

  test('contains no console.log calls', () => {
    const offenders = sourceFiles.filter(rel =>
      /console\s*\.\s*log\s*\(/.test(readFileSync(join(root, rel), 'utf8'))
    );
    expect(offenders).toEqual([]);
  });
});
