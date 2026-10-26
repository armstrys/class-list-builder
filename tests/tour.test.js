import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildStudentTemplateCSV, parseCSV, generateCSVHeaders } from '../src/csv.js';

/**
 * Guards for the guided tour and the CSV template it points at.
 *
 * Static assertions, matching every other test in this project: there is no
 * jsdom/React setup. The tour's failure mode is silent (a step that names a
 * control nothing carries simply draws no ring), so the anchor list and the
 * step list are checked against each other in both directions.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(join(root, rel), 'utf8');

function srcFiles(dir = join(root, 'src'), acc = []) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) srcFiles(abs, acc);
    else if (entry.endsWith('.js')) acc.push(abs);
  }
  return acc;
}

/** Targets named by TOUR_STEPS, in order. */
function stepTargets() {
  const tour = read('src/components/Tour.js');
  return [...tour.matchAll(/\{\s*target:\s*'([^']+)'/g)].map(m => m[1]);
}

/** Targets actually present as data-tour attributes across src/. */
function anchorTargets() {
  const all = srcFiles().map(f => readFileSync(f, 'utf8')).join('\n');
  // Skip the tour's own `[data-tour="${...}"]` selector.
  return [...all.matchAll(/data-tour="([^"$]+)"/g)].map(m => m[1]);
}

describe('tour anchors', () => {
  test('every step points at a control that exists', () => {
    const anchors = new Set(anchorTargets());
    expect(stepTargets().filter(t => !anchors.has(t))).toEqual([]);
  });

  test('every anchor is named by a step, so no ring appears off-script', () => {
    const steps = new Set(stepTargets());
    expect(anchorTargets().filter(t => !steps.has(t))).toEqual([]);
  });

  test('steps are unique and the walkthrough covers the demo asks', () => {
    const targets = stepTargets();
    expect(new Set(targets).size).toBe(targets.length);
    expect(targets).toEqual(
      expect.arrayContaining(['classes', 'criteria', 'import', 'constraints', 'save', 'optimize'])
    );
  });

  test('the template is offered where the import happens, and the step says so', () => {
    expect(read('src/components/ImportModal.js')).toContain('buildStudentTemplateCSV(');
    const tour = read('src/components/Tour.js');
    const importStep = tour.slice(tour.indexOf("target: 'import'"));
    expect(importStep.slice(0, 400)).toMatch(/template/i);
  });

  test('the tour can be left from the panel and from the header', () => {
    const tour = read('src/components/Tour.js');
    expect(tour).toMatch(/setCurrentTourStep\(null\)/);
    expect(tour).toMatch(/aria-label="End tour"/);
    expect(read('src/app.js')).toMatch(/onStartTour=\{\(\) => setCurrentTourStep\(0\)\}/);
  });

  test('the Demo button starts the tour', () => {
    const app = read('src/app.js');
    const demo = app.slice(app.indexOf('onLoadDemo='), app.indexOf('function Header'));
    expect(demo).toContain('setCurrentTourStep(0)');
  });

  test('the ring moves with the step and cleans up after itself', () => {
    const app = read('src/app.js');
    expect(app).toMatch(/classList\.add\('tour-target'\)/);
    expect(app).toMatch(/remove\('tour-target'\)/);
    // Two-tone so it reads on a filled primary button; one-shot entrance,
    // and the global reduced-motion rule covers the animation.
    const css = read('src/styles.css');
    const ring = css.match(/\.tour-target\s*\{[^}]*\}/);
    expect(ring).toBeTruthy();
    expect(ring[0]).toContain('var(--accent)');
    expect(ring[0]).toContain('var(--bg)');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});

describe('CSV template', () => {
  const numericCriteria = [
    { key: 'readingScore', label: 'Reading Score', weight: 1 },
    { key: 'mathScore', label: 'Math Score', weight: 1 },
  ];
  const flagCriteria = [{ key: 'sped', label: 'SPED', weight: 2 }];
  const categoryCriteria = [{ key: 'currentclass', label: 'Current Class', weight: 1 }];

  test('headers match what the importer expects', () => {
    const headerLine = buildStudentTemplateCSV(numericCriteria, flagCriteria, categoryCriteria).split('\n')[0];
    expect(headerLine.split(',')).toEqual([
      'id',
      ...generateCSVHeaders(numericCriteria, flagCriteria, categoryCriteria),
    ]);
  });

  test('the template imports cleanly with no warnings', () => {
    const { students, errors } = parseCSV(
      buildStudentTemplateCSV(numericCriteria, flagCriteria, categoryCriteria),
      numericCriteria,
      flagCriteria,
      categoryCriteria
    );
    expect(errors).toEqual([]);
    expect(students).toHaveLength(1);
    expect(students[0].name).toBe('Jordan Example');
    expect(students[0].sped).toBe(false);
    expect(students[0].readingScore).toBe(0);
  });

  test('it works with no criteria configured at all', () => {
    const csv = buildStudentTemplateCSV([], [], []);
    expect(csv.split('\n')[0]).toBe('id,name,gender');
    expect(parseCSV(csv, [], [], []).errors).toEqual([]);
  });
});
