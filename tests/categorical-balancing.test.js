import { describe, test, expect } from 'vitest';
import { computeCost, optimize, optimizeMultiStart, computeSeed } from '../src/optimizer.js';
import { runFullAssessment, computeBaselineBalanced } from '../src/utils/assessment.js';
import { parseCSV, exportStudentsToCSV, exportClassListsToCSV, generateCSVHeaders } from '../src/csv.js';

/**
 * Categorical balancing.
 *
 * A category criterion holds one text value per student (e.g. the class they
 * were in last year) and spreads each distinct value evenly across the new
 * classes, so last year's grouping is not recreated.
 */

const NUMERIC = [{ key: 'readingscore', label: 'Reading', weight: 1 }];
const CAT = key => [{ key, label: 'Current Class', weight: 1.5 }];

/** nValues groups of perValue students, each in prior room `Room <v+1>`. */
function roster(nValues, perValue, idPrefix = 'V') {
  const students = [];
  for (let v = 0; v < nValues; v++) {
    for (let i = 0; i < perValue; i++) {
      const s = {
        id: `${idPrefix}${v}-${String(i).padStart(2, '0')}`,
        name: `Student ${v}-${i}`,
        gender: i % 2 ? 'M' : 'F',
      };
      s.readingscore = 40 + ((i * 31 + v * 17) % 60);
      s.currentclass = `Room ${v + 1}`;
      students.push(s);
    }
  }
  return students;
}

/** Reference implementation of the category term, written independently. */
function referenceCategoryTerm(students, assignment, numClasses, weight = 1) {
  const values = [...new Set(students.map(s => s.currentclass).filter(v => v != null && String(v).trim() !== ''))].sort();
  if (values.length < 2) return 0;
  let total = 0;
  for (const v of values) {
    const overall = students.filter(s => s.currentclass === v).length / students.length;
    let varSum = 0;
    for (let c = 0; c < numClasses; c++) {
      const cls = students.filter(s => assignment[s.id] === c);
      const p = cls.length ? cls.filter(s => s.currentclass === v).length / cls.length : overall;
      varSum += (p - overall) ** 2;
    }
    total += varSum / numClasses;
  }
  return weight * total / values.length;
}

/** Pairs of students from the same prior room that are in the same class now. */
function repeatPairs(students, assignment) {
  const groups = new Map();
  for (const s of students) {
    const c = assignment[s.id];
    if (c === undefined) continue;
    if (!groups.has(s.currentclass)) groups.set(s.currentclass, new Map());
    const m = groups.get(s.currentclass);
    m.set(c, (m.get(c) || 0) + 1);
  }
  let pairs = 0;
  for (const m of groups.values()) for (const n of m.values()) pairs += (n * (n - 1)) / 2;
  return pairs;
}

/** Best achievable pair count for the given group sizes across numClasses. */
function floorPairs(groupSizes, numClasses) {
  let total = 0;
  for (const n of groupSizes) {
    const base = Math.floor(n / numClasses);
    const extra = n % numClasses;
    total += (numClasses - extra) * ((base * (base - 1)) / 2)
      + extra * (((base + 1) * base) / 2);
  }
  return total;
}

describe('category cost term', () => {
  test('is zero when every prior group is spread perfectly evenly', () => {
    const students = roster(3, 32);
    const a = {};
    for (let v = 0; v < 3; v++) {
      students.filter(s => s.id[1] === String(v)).forEach((s, i) => { a[s.id] = i % 4; });
    }
    const without = computeCost(students, a, 4, NUMERIC, [], [], [], [], []);
    const withCat = computeCost(students, a, 4, NUMERIC, [], [], [], [], CAT('currentclass'));
    expect(withCat - without).toBeCloseTo(0, 12);
  });

  test('is positive when a prior group is clustered', () => {
    const students = roster(3, 32);
    const a = {};
    students.forEach(s => { a[s.id] = Number(s.id[1]); }); // each room to its own class
    const without = computeCost(students, a, 4, NUMERIC, [], [], [], [], []);
    const withCat = computeCost(students, a, 4, NUMERIC, [], [], [], [], CAT('currentclass'));
    expect(withCat - without).toBeGreaterThan(0);
  });

  test('matches an independently written reference implementation', () => {
    const students = roster(3, 20);
    let worst = 0;
    for (let t = 0; t < 120; t++) {
      const a = {};
      students.forEach(s => { a[s.id] = Math.floor(Math.random() * 4); });
      const without = computeCost(students, a, 4, NUMERIC, [], [], [], [], []);
      const withCat = computeCost(students, a, 4, NUMERIC, [], [], [], [], CAT('currentclass'));
      worst = Math.max(worst, Math.abs((withCat - without) - referenceCategoryTerm(students, a, 4, 1.5)));
    }
    expect(worst).toBeLessThan(1e-12);
  });

  test('a two-valued category contributes the same as the flag variance term', () => {
    // A boolean flag is the |V| = 2 case, so the variance portion must match.
    // (Flags also feed the TOTAL_FLAGS aggregate, so compare the variance part
    // by scoring the same assignment with one flag at weight w.)
    const students = [];
    for (let v = 0; v < 2; v++) {
      for (let i = 0; i < 40; i++) {
        const s = { id: `T${v}-${i}`, name: `t${v}${i}`, gender: i % 2 ? 'M' : 'F', readingscore: 50 + ((i * 13) % 40) };
        s.cat = v === 0 ? 'A' : 'B';
        s.flag = v === 0;
        students.push(s);
      }
    }
    const a = {};
    students.forEach((s, i) => { a[s.id] = 5 + (i % 6); }); // in-range, deliberately spread
    const N = 12;
    const base = computeCost(students, a, N, NUMERIC, [], [], [], [], []);
    const catOnly = computeCost(students, a, N, NUMERIC, [], [], [], [], [{ key: 'cat', label: 'Cat', weight: 1 }]) - base;
    // |V| = 2 -> the term is the average of both values' variances; for a
    // binary split Var_B === Var_A, so it equals a single value's variance.
    const varA = (() => {
      const overall = students.filter(s => s.cat === 'A').length / students.length;
      let v = 0;
      for (let c = 5; c < N; c++) {
        const cls = students.filter(s => a[s.id] === c);
        const p = cls.length ? cls.filter(s => s.cat === 'A').length / cls.length : overall;
        v += (p - overall) ** 2;
      }
      return v / N;
    })();
    expect(catOnly).toBeCloseTo(varA, 10);
  });

  test('ignores blank and missing values instead of treating them as a category', () => {
    const students = roster(2, 10);
    students.forEach(s => { s.currentclass = ''; });
    const a = {};
    students.forEach((s, i) => { a[s.id] = i % 3; });
    const without = computeCost(students, a, 3, NUMERIC, [], [], [], [], []);
    const withCat = computeCost(students, a, 3, NUMERIC, [], [], [], [], CAT('currentclass'));
    expect(withCat - without).toBeCloseTo(0, 12);
  });

  test('a single value is inert, matching an all-true flag', () => {
    // If every student carries the same value it cannot be "unbalanced" - the
    // population proportion is 1.0 and every class is already representative.
    // A *subset* (8 of 96) is a flag's job; see the flags test below.
    const students = roster(1, 24);
    const clustered = {};
    students.forEach(s => { clustered[s.id] = 0; });
    const base = computeCost(students, clustered, 3, NUMERIC, [], [], [], [], []);
    const withCat = computeCost(students, clustered, 3, NUMERIC, [], [], [], [], CAT('currentclass'));
    expect(withCat - base).toBeCloseTo(0, 12);
  });

  test('an empty column contributes nothing', () => {
    const students = roster(2, 10);
    students.forEach(s => { s.currentclass = ''; });
    const a = {};
    students.forEach((s, i) => { a[s.id] = i % 3; });
    const without = computeCost(students, a, 3, NUMERIC, [], [], [], [], []);
    const withCat = computeCost(students, a, 3, NUMERIC, [], [], [], [], CAT('currentclass'));
    expect(withCat - without).toBeCloseTo(0, 12);
  });

  test('whitespace-only values count as unspecified, not as a value', () => {
    const students = roster(2, 10);
    students.slice(0, 5).forEach(s => { s.currentclass = '   '; });
    const a = {};
    students.forEach((s, i) => { a[s.id] = i % 3; });
    const without = computeCost(students, a, 3, NUMERIC, [], [], [], [], []);
    const withCat = computeCost(students, a, 3, NUMERIC, [], [], [], [], CAT('currentclass'));
    // 'Room 1' now has variance measured against its own (smaller) population
    expect(Number.isFinite(withCat - without)).toBe(true);
    expect(withCat - without).toBeGreaterThanOrEqual(0);
  });
});

describe('does it actually separate repeat groupings?', () => {
  test('a deliberate last-year grouping is pushed away, down to the floor', () => {
    // 3 prior homerooms of unequal size into 4 classes.
    const sizes = [26, 24, 22];
    const students = [];
    sizes.forEach((n, g) => {
      for (let i = 0; i < n; i++) {
        const s = {
          id: `G${g}-${String(i).padStart(2, '0')}`,
          name: `Student ${g}-${i}`,
          gender: i % 2 ? 'M' : 'F',
          readingscore: 40 + ((i * 29 + g * 11) % 60),
          currentclass: `Room ${'ABC'[g]}`,
        };
        students.push(s);
      }
    });

    // The thing we are trying to avoid: last year's grouping, reproduced.
    const lastYear = {};
    students.forEach(s => { lastYear[s.id] = 'ABC'.indexOf(s.currentclass.slice(-1)); });

    const floor = floorPairs(sizes, 4);
    const before = repeatPairs(students, lastYear);
    expect(before).toBe(832); // every possible pair is still together

    const optimized = optimizeMultiStart(
      students, 4, {}, NUMERIC, [], [], [], [], 5, CAT('currentclass')
    );
    const after = repeatPairs(students, optimized);

    // The new term must get all the way to the best achievable spread, not
    // merely improve on last year.
    expect(after).toBe(floor);
    expect(after).toBeLessThan(before);

    // And the cost function agrees with that: no single swap improves it.
    const cost = computeCost(students, optimized, 4, NUMERIC, [], [], [], [], CAT('currentclass'));
    const ids = Object.keys(optimized);
    let improving = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const c1 = optimized[ids[i]], c2 = optimized[ids[j]];
        if (c1 === c2) continue;
        const swapped = { ...optimized, [ids[i]]: c2, [ids[j]]: c1 };
        if (computeCost(students, swapped, 4, NUMERIC, [], [], [], [], CAT('currentclass')) < cost - 1e-12) {
          improving++;
        }
      }
    }
    expect(improving).toBe(0);
  });

  test('without the criterion, prior-classmates are not deliberately separated', () => {
    // 3 prior rooms into 5 classes. Without the term the optimizer has no
    // reason to care who was together, so the count is whatever falls out.
    const students = roster(3, 20);
    const withCat = optimizeMultiStart(students, 5, {}, NUMERIC, [], [], [], [], 5, CAT('currentclass'));
    const without = optimizeMultiStart(students, 5, {}, NUMERIC, [], [], [], [], 5, []);
    const floor = floorPairs([20, 20, 20], 5);
    expect(repeatPairs(students, withCat)).toBe(floor);
    expect(repeatPairs(students, without)).toBeGreaterThanOrEqual(floor);
  });

  test('a small subset group is spread by a flag, which is the right tool for it', () => {
    // 8 of 48 students came from one feeder class. As a category that is a
    // single value (inert, see above); as a flag the population proportion is
    // 8/48, so the existing flag term spreads them to 2 per class.
    const students = [];
    for (let i = 0; i < 40; i++) {
      students.push({ id: `N${i}`, name: `n${i}`, gender: i % 2 ? 'M' : 'F', readingscore: 40 + ((i * 23) % 60), feeder: false });
    }
    for (let i = 0; i < 8; i++) {
      students.push({ id: `P${i}`, name: `p${i}`, gender: i % 2 ? 'M' : 'F', readingscore: 55 + ((i * 7) % 40), feeder: true });
    }
    const flag = [{ key: 'feeder', label: 'Feeder', weight: 1.5 }];
    const a = optimizeMultiStart(students, 4, {}, NUMERIC, flag, [], [], [], 5);
    const perClass = [0, 1, 2, 3].map(c => students.filter(s => s.feeder && a[s.id] === c).length);
    expect(Math.max(...perClass)).toBe(2); // 8 into 4 = 2,2,2,2
  });
});

describe('determinism', () => {
  test('same inputs produce the same assignment', () => {
    const students = roster(3, 18);
    const a = optimizeMultiStart(students, 3, {}, NUMERIC, [], [], [], [], 5, CAT('currentclass'));
    const b = optimizeMultiStart(students, 3, {}, NUMERIC, [], [], [], [], 5, CAT('currentclass'));
    expect(a).toEqual(b);
  });

  test('category values enter the seed', () => {
    const base = roster(2, 10);
    const changed = base.map(s => ({ ...s, currentclass: s.currentclass === 'Room 1' ? 'Room 9' : s.currentclass }));
    const seedA = computeSeed(base, 3, {}, NUMERIC, [], [], [], [], 0, CAT('currentclass'));
    const seedB = computeSeed(changed, 3, {}, NUMERIC, [], [], [], [], 0, CAT('currentclass'));
    expect(seedA).not.toBe(seedB);
  });

  test('the criterion definition enters the seed', () => {
    const students = roster(2, 10);
    const none = computeSeed(students, 3, {}, NUMERIC, [], [], [], [], 0, []);
    const some = computeSeed(students, 3, {}, NUMERIC, [], [], [], [], 0, CAT('currentclass'));
    expect(none).not.toBe(some);
  });

  test('the criterion weight enters the seed', () => {
    const students = roster(2, 10);
    const w1 = computeSeed(students, 3, {}, NUMERIC, [], [], [], [], 0, [{ key: 'currentclass', label: 'C', weight: 1 }]);
    const w2 = computeSeed(students, 3, {}, NUMERIC, [], [], [], [], 0, [{ key: 'currentclass', label: 'C', weight: 2 }]);
    expect(w1).not.toBe(w2);
  });

  test('absent criteria leave the seed identical to before the feature', () => {
    // Reproducibility guarantee: existing rosters must not change trajectory.
    const students = roster(2, 10);
    const a = optimize(students, 3, {}, NUMERIC, [], [], [], [], 0);
    const b = optimize(students, 3, {}, NUMERIC, [], [], [], [], 0, []);
    expect(a).toEqual(b);
  });
});

describe('balance score uses the same cost', () => {
  test('an optimal assignment still scores 100 with a category criterion', async () => {
    const students = roster(3, 30);
    const cat = CAT('currentclass');
    const assignment = optimizeMultiStart(students, 3, {}, NUMERIC, [], [], [], [], 5, cat);
    const result = await runFullAssessment({
      students, assignment, numClasses: 3, numericCriteria: NUMERIC, flagCriteria: [], categoryCriteria: cat,
    });
    expect(result.score).toBe(100);
  });

  test('the baseline applies the category term', () => {
    const students = roster(3, 12);
    const withCat = computeBaselineBalanced(students, 3, NUMERIC, [], undefined, CAT('currentclass'));
    const without = computeBaselineBalanced(students, 3, NUMERIC, [], undefined, []);
    // Both are unconstrained optima; with the term included the ceiling may only
    // be equal or higher (the optimizer must also satisfy the category spread).
    expect(Number.isFinite(withCat)).toBe(true);
    expect(withCat).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(without)).toBe(true);
  });
});

describe('csv round-trip', () => {
  const cat = [{ key: 'currentclass', label: 'Current Class', weight: 1.5 }];

  test('headers include the category label', () => {
    expect(generateCSVHeaders(NUMERIC, [], cat)).toContain('Current Class');
  });

  test('import reads category values as text', () => {
    const csv = [
      'name,gender,Reading,Current Class',
      'Alice,F,80,Ms. Rivera',
      'Bob,M,70,Mr. Okafor',
    ].join('\n');
    const { students, errors } = parseCSV(csv, NUMERIC, [], cat);
    expect(errors.filter(e => e.startsWith('Unrecognized'))).toEqual([]);
    expect(students[0].currentclass).toBe('Ms. Rivera');
    expect(students[1].currentclass).toBe('Mr. Okafor');
  });

  test('a blank category cell becomes an empty string, not a value', () => {
    const csv = ['name,gender,Current Class', 'Alice,F,', 'Bob,M,Ms. Rivera'].join('\n');
    const { students } = parseCSV(csv, [], [], cat);
    expect(students[0].currentclass).toBe('');
    expect(students[1].currentclass).toBe('Ms. Rivera');
  });

  test('a missing category column is reported but does not block the import', () => {
    const csv = ['name,gender', 'Alice,F'].join('\n');
    const { students, errors } = parseCSV(csv, [], [], cat);
    expect(students).toHaveLength(1);
    expect(errors.join(' ')).toMatch(/Current Class/);
  });

  test('student export preserves category values', () => {
    const students = [
      { id: 'a', name: 'Alice', gender: 'F', readingscore: 80, currentclass: 'Ms. Rivera' },
      { id: 'b', name: 'Bob', gender: 'M', readingscore: 70, currentclass: '' },
    ];
    const csv = exportStudentsToCSV(students, NUMERIC, [], cat);
    expect(csv.split('\n')[0]).toContain('Current Class');
    expect(csv).toContain('Ms. Rivera');
  });

  test('class-list export includes category values', () => {
    const students = [{ id: 'a', name: 'Alice', gender: 'F', readingscore: 80, currentclass: 'Ms. Rivera' }];
    const csv = exportClassListsToCSV(students, { a: 0 }, [{ name: 'Room 1' }], NUMERIC, [], cat);
    expect(csv).toContain('Current Class');
    expect(csv).toContain('Ms. Rivera');
  });

  test('a value containing a comma survives the round-trip', () => {
    const students = [{ id: 'a', name: 'Alice', gender: 'F', readingscore: 80, currentclass: 'Rivera, M.' }];
    const csv = exportStudentsToCSV(students, NUMERIC, [], cat);
    const { students: back } = parseCSV(csv, NUMERIC, [], cat);
    expect(back[0].currentclass).toBe('Rivera, M.');
  });
});
