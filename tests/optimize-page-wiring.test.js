import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Guards for how OptimizePage wires its effects and its board.
 *
 * These are static assertions over source, not DOM tests, for the same reason
 * `tests/a11y-behavior.test.js` is: the project has no jsdom/React testing
 * setup, so a mounted-component test would mean adding a whole harness to check
 * a dependency array. Everything the effects compute is already tested on its
 * own (`optimizer.test.js`, `assessment.test.js`); what is untested without a
 * harness is the wiring, and that is exactly what these assertions pin.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(join(root, rel), 'utf8');

const optimizePage = read('src/components/OptimizePage.js');

/**
 * The dependency array of the first effect that follows `anchor`.
 *
 * @param {string} source - Module source
 * @param {string} anchor - Text that appears inside the effect body
 * @returns {string[]} Trimmed dep identifiers
 */
function depArrayAfter(source, anchor) {
  const at = source.indexOf(anchor);
  expect(at).toBeGreaterThan(-1);
  const match = source.slice(at).match(/\},\s*\[([^\]]*)\]\s*\);/);
  expect(match, `no dependency array found after ${anchor}`).not.toBeNull();
  return match[1]
    .split(',')
    .map(dep => dep.trim())
    .filter(Boolean);
}

describe('OptimizePage assessment effect', () => {
  const deps = depArrayAfter(optimizePage, 'runFullAssessment({');

  // #105: the assessment adds the constraint penalties to the balance score, so
  // a constraint edit changes the true cost with the assignment untouched. With
  // the constraint sets missing from the deps, the number on screen went stale
  // and a teacher could add a violated separation without the score moving.
  test('depends on keep-apart, keep-together and keep-out-of-class', () => {
    expect(deps).toContain('keepApart');
    expect(deps).toContain('keepTogether');
    expect(deps).toContain('keepOutOfClass');
  });

  test('still depends on the assignment and every criteria set', () => {
    for (const dep of [
      'students',
      'assignment',
      'numClasses',
      'numericCriteria',
      'flagCriteria',
      'categoryCriteria',
    ]) {
      expect(deps).toContain(dep);
    }
  });
});
