import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Guards for the v3.2.0 accessibility pass.
 *
 * These are static assertions over source and CSS rather than DOM tests,
 * because the project has no jsdom/React testing setup (every existing test
 * exercises pure logic modules). They catch the exact regressions this pass
 * fixed: undefined design tokens, a dialog rendered inside the subtree it
 * aria-hides, mouse-only student movement, and the layout-wiping class count.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(join(root, rel), 'utf8');

const styles = read('src/styles.css');
const modal = read('src/components/Modal.js');
const studentCard = read('src/components/StudentCard.js');
const studentDetail = read('src/components/StudentDetailModal.js');
const classColumn = read('src/components/ClassColumn.js');
const contexts = read('src/contexts/index.js');

/** Every var(--token) referenced across src/, and every --token declared in CSS. */
function tokenAudit() {
  const srcFiles = [
    'src/styles.css',
    'src/app.js',
    'src/optimizer.js',
    'src/defaults.js',
    'src/csv.js',
    'src/sample-data.js',
    'src/utils/assessment.js',
    'src/utils/projectSerializer.js',
    'src/utils/projectDeserializer.js',
    'src/contexts/index.js',
    ...read('src/components/Modal.js') && [
      'src/components/AssessmentModal.js',
      'src/components/ClassColumn.js',
      'src/components/ClassFilterDropdown.js',
      'src/components/HelpModal.js',
      'src/components/ImportModal.js',
      'src/components/LoadProjectModal.js',
      'src/components/OptimizePage.js',
      'src/components/PrintReportView.js',
      'src/components/SampleDataDialog.js',
      'src/components/SaveProjectModal.js',
      'src/components/SettingsModal.js',
      'src/components/SetupPage.js',
      'src/components/StudentCard.js',
      'src/components/StudentDetailModal.js',
      'src/components/ViolationsModal.js',
      'src/components/WelcomeModal.js',
      'src/components/StudentFormModal.js',
      'src/components/constraints/ApartTab.js',
      'src/components/constraints/ConstraintModal.js',
      'src/components/constraints/OutOfClassTab.js',
      'src/components/constraints/StudentMultiselect.js',
      'src/components/constraints/TogetherTab.js',
    ],
  ].flat();

  const all = srcFiles.map(read).join('\n');
  // A var() with a fallback (var(--x, #fff)) still paints, so only bare
  // references are real defects.
  const used = new Set(
    [...all.matchAll(/var\((--[a-z0-9-]+)\s*([,)])/gi)]
      .filter(m => m[2] === ')')
      .map(m => m[1])
  );
  const defined = new Set([...styles.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map(m => m[1]));
  return { used: [...used].sort(), defined, missing: [...used].filter(t => !defined.has(t)).sort() };
}

describe('design tokens', () => {
  test('every referenced CSS custom property is declared', () => {
    const { missing } = tokenAudit();
    expect(missing).toEqual([]);
  });

  test('the aliases that used to render transparent are declared', () => {
    for (const token of ['--warning', '--error', '--success', '--text1', '--bg1', '--bg2', '--primary', '--radius-md']) {
      expect(styles).toMatch(new RegExp(`${token}\\s*:`));
    }
  });

  test('both themes define the core surface and text ramp', () => {
    const lightBlock = styles.slice(styles.indexOf(':root {'), styles.indexOf(":root[data-theme='dark']"));
    const darkBlock = styles.slice(styles.indexOf(":root[data-theme='dark']"));
    for (const token of ['--bg', '--surface', '--surface2', '--border', '--text', '--text2', '--text3', '--accent']) {
      expect(lightBlock).toContain(`${token}:`);
      expect(darkBlock).toContain(`${token}:`);
    }
  });
});

describe('focus and motion', () => {
  test('a :focus-visible rule exists', () => {
    expect(styles).toMatch(/:focus-visible\s*\{[^}]*outline\s*:/);
  });

  test('no rule removes the outline without a replacement indicator', () => {
    // `.form-input`/`.csv-area` used to set `outline: none` and rely on a border
    // color shift alone, which is invisible for keyboard users.
    expect(styles).not.toMatch(/\.form-input[^{]*\{[^}]*outline:\s*none/);
    expect(styles).not.toMatch(/\.csv-area:focus\s*\{\s*outline:\s*none/);
  });

  test('prefers-reduced-motion is respected', () => {
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });
});

describe('layout performance', () => {
  test('stat bars animate transform, not width', () => {
    const rule = styles.match(/\.class-stat-bar\s*\{[^}]*\}/);
    expect(rule).toBeTruthy();
    expect(rule[0]).toContain('transform');
    expect(rule[0]).not.toMatch(/transition:\s*width/);
    // The fill must be full-width and scaled, or scaleX has nothing to scale.
    expect(rule[0]).toContain('width: 100%');
  });

  test('ClassColumn scales the bar instead of setting a width', () => {
    expect(classColumn).toContain('scaleX(');
    expect(classColumn).not.toMatch(/class-stat-bar" style=\{\{ width:/);
  });

  test('the locked marker does not change the card box', () => {
    const rule = styles.match(/\.student-card\.locked\s*\{[^}]*\}/);
    expect(rule).toBeTruthy();
    expect(rule[0]).toContain('inset');
    expect(rule[0]).not.toMatch(/border-left:\s*3px/);
  });
});

describe('responsive', () => {
  test('more than the two original breakpoints exist', () => {
    const breakpoints = [...styles.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map(m => m[1]);
    expect(breakpoints).toContain('900');
    expect(breakpoints).toContain('640');
  });

  test('class columns are no longer a hard 340px at every viewport', () => {
    const base = styles.match(/\.class-col\s*\{[^}]*\}/)[0];
    expect(base).toContain('width: 340px');
    const narrow = styles.slice(styles.indexOf('@media (max-width: 900px)'));
    expect(narrow).toMatch(/\.class-col\s*\{\s*width:\s*min\(/);
  });

  test('the setup grid collapses on narrow screens', () => {
    const narrow = styles.slice(styles.indexOf('@media (max-width: 900px)'));
    expect(narrow).toMatch(/\.setup-layout\s*\{\s*grid-template-columns:\s*1fr/);
  });
});

describe('dialogs', () => {
  test('Modal renders through a portal to document.body', () => {
    expect(modal).toContain('ReactDOM.createPortal');
    expect(modal).toMatch(/document\.body/);
  });

  test('aria-hidden is scoped to #root only, never document.body', () => {
    // Hiding body would also hide the portalled dialog.
    expect(modal).toContain("getElementById('root')");
    expect(modal).not.toMatch(/getElementById\('root'\)\s*\|\|\s*document\.body/);
  });

  test('Modal still traps focus, restores it, and closes on Escape', () => {
    expect(modal).toContain('previouslyFocusedRef');
    expect(modal).toMatch(/e\.key === 'Escape'/);
    expect(modal).toContain("'Tab'");
  });
});

describe('keyboard and touch access to moving students', () => {
  test('the student card is focusable and named', () => {
    expect(studentCard).toMatch(/role="button"/);
    expect(studentCard).toMatch(/tabIndex=\{0\}/);
    expect(studentCard).toMatch(/aria-label=/);
  });

  test('Enter and Space open the detail dialog', () => {
    expect(studentCard).toMatch(/onKeyDown=/);
    expect(studentCard).toMatch(/e\.key === 'Enter'/);
    expect(studentCard).toMatch(/' '/);
  });

  test('the detail dialog exposes a class picker wired to setAssignment', () => {
    expect(studentDetail).toContain('useStudentsExport');
    expect(studentDetail).toMatch(/setAssignment\(\{/);
    expect(studentDetail).toMatch(/<select/);
    expect(studentDetail).toMatch(/htmlFor=/);
  });

  test('the picker writes a numeric class index, not the raw string', () => {
    expect(studentDetail).toMatch(/Number\(e\.target\.value\)/);
  });
});

describe('status announcements', () => {
  const optimize = read('src/components/OptimizePage.js');

  test('a polite live region exists for optimize/balance/violation status', () => {
    expect(optimize).toMatch(/aria-live="polite"/);
    expect(optimize).toMatch(/role="status"/);
  });

  test('the live region reports all three status signals', () => {
    const region = optimize.slice(optimize.indexOf('aria-live="polite"'));
    expect(region).toMatch(/optimizing/i);
    expect(region).toMatch(/violation/i);
    expect(region).toMatch(/Balance score/);
  });

  test('.sr-only is defined so the region is not visible', () => {
    expect(styles).toMatch(/\.sr-only\s*\{[^}]*clip:\s*rect/);
  });
});

describe('class-count change does not wipe assignments', () => {
  /**
   * Mirrors clearAssignmentsForClassCountChange: only clear when an existing
   * assignment lands outside the new class range.
   */
  function shouldClear(assignment, numClasses) {
    if (numClasses <= 0) return false;
    return Object.values(assignment).some(idx => idx < 0 || idx >= numClasses);
  }

  test('growing the class count keeps the board', () => {
    expect(shouldClear({ a: 0, b: 1, c: 2 }, 30)).toBe(false);
  });

  test('shrinking below an assigned index clears', () => {
    expect(shouldClear({ a: 0, b: 1, c: 4 }, 2)).toBe(true);
  });

  test('shrinking to a range that still contains every assignment keeps them', () => {
    expect(shouldClear({ a: 0, b: 1 }, 2)).toBe(false);
  });

  test('an empty assignment never triggers a clear', () => {
    expect(shouldClear({}, 3)).toBe(false);
  });

  test('the context snapshots before clearing so it is undoable', () => {
    const fn = contexts.slice(
      contexts.indexOf('const clearAssignmentsForClassCountChange'),
      contexts.indexOf('const value = {')
    );
    expect(fn).toContain('pushSnapshot()');
    expect(fn.indexOf('pushSnapshot()')).toBeLessThan(fn.indexOf('setAssignment({})'));
    expect(fn).toMatch(/if \(!hasInvalidAssignments\) return;/);
  });
});

describe('unload guard', () => {
  const app = read('src/app.js');

  test('a beforeunload guard is registered', () => {
    expect(app).toMatch(/beforeunload/);
    expect(app).toMatch(/e\.returnValue = ''/);
  });

  test('the guard is removed on cleanup', () => {
    expect(app).toMatch(/removeEventListener\('beforeunload'/);
  });
});

describe('modal dismissal gating', () => {
  test('Escape respects closeOnOverlayClick, not just the overlay click', () => {
    // Escape used to fire unconditionally, which would have let a keystroke
    // bypass the load-project overwrite confirmation.
    const esc = modal.slice(modal.indexOf("e.key === 'Escape'"), modal.indexOf("e.key === 'Tab'"));
    expect(esc).toMatch(/closeOnOverlayClick/);
  });

  test('LoadProjectModal gates dismissal while the overwrite confirm is up', () => {
    const load = read('src/components/LoadProjectModal.js');
    expect(load).toMatch(/closeOnOverlayClick=\{!showOverwriteConfirm\}/);
  });

  test('the class picker ignores the empty placeholder value', () => {
    // Number('') is 0, so an unguarded change handler would assign class 1.
    expect(studentDetail).toMatch(/e\.target\.value === ''\s*\)\s*return/);
  });
});
