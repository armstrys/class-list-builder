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

describe('OptimizePage auto-reoptimize effect', () => {
  const deps = depArrayAfter(optimizePage, 'handleReoptimize();');

  // #106: runOptimize passes category criteria to the optimizer, so a category
  // weight change alters the trajectory the board should be on. Numeric and
  // flag changes re-ran the optimizer; category changes did not, and the board
  // silently stayed on its old placement until Re-Optimize was pressed.
  test('re-runs when any criteria set changes, category criteria included', () => {
    for (const dep of ['numericCriteria', 'flagCriteria', 'categoryCriteria']) {
      expect(deps).toContain(dep);
    }
  });

  // The effect must not depend on the results it produces, or every reoptimize
  // feeds the next one.
  test('does not depend on the assignment it rewrites or its own handler', () => {
    expect(deps).not.toContain('assignment');
    expect(deps).not.toContain('optimizing');
    expect(deps).not.toContain('handleReoptimize');
  });
});

describe('the balance score reports the students it does not count (#103)', () => {
  const unplacedBlock = () => {
    const at = optimizePage.indexOf('const unplaced = useMemo');
    expect(at).toBeGreaterThan(-1);
    return optimizePage.slice(at, optimizePage.indexOf(');', at));
  };

  test('derives unplaced students from an assignment the board cannot render', () => {
    const block = unplacedBlock();
    // Same validity rule the cost function and the columns use: a student is
    // placed only when the assignment names a class that exists.
    expect(block).toMatch(/const c = assignment\[s\.id\]/);
    expect(block).toMatch(/c >= 0 && c < numClasses/);
  });

  test('shows the count next to the balance score', () => {
    const badge = optimizePage.slice(optimizePage.indexOf('className="score-badge"'));
    expect(badge).toMatch(/unplaced\.length > 0/);
    expect(badge).toMatch(/not placed/);
  });

  test('announces the count to screen readers with the score', () => {
    expect(optimizePage).toMatch(/not placed in a class/);
  });
});
