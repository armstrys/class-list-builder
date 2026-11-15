import { describe, test, expect } from 'vitest';
import { computeCost, computeCostTerms } from '../src/optimizer.js';
import { runFullAssessment, rankCostTerms } from '../src/utils/assessment.js';

/**
 * Balance score attribution.
 *
 * `computeCostTerms` itemises the cost model and `computeCost` is its sum. These
 * tests hold that invariant, the term identities the UI displays, and the
 * ranking helper the assessment modal renders — a breakdown that disagrees with
 * the score it explains is worse than no breakdown at all.
 */

const NUMERIC = [
  { key: 'reading', label: 'Reading', weight: 1 },
  { key: 'math', label: 'Math', weight: 2 },
];
const FLAGS = [{ key: 'iep', label: 'IEP', weight: 1 }];
const CATEGORIES = [{ key: 'priorClass', label: 'Current Class', weight: 1.5 }];

/** Twelve students across three classes, every criterion populated. */
function roster(count = 12) {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${String(i).padStart(2, '0')}`,
    name: `Student ${i + 1}`,
    gender: ['F', 'M', 'U'][i % 3],
    reading: 30 + ((i * 17) % 70),
    math: 20 + ((i * 29) % 80),
    iep: i % 4 === 0,
    priorClass: ['Room 1', 'Room 2', 'Room 3'][i % 3],
  }));
}

/** Round-robin assignment, so no class is accidentally empty. */
function roundRobin(students, numClasses = 3) {
  const assignment = {};
  students.forEach((s, i) => {
    assignment[s.id] = i % numClasses;
  });
  return assignment;
}

function sumTerms(terms) {
  return terms.reduce((sum, term) => sum + term.cost, 0);
}

// Constraints that round-robin assignments break: s00 and s03 share class 0,
// s01 and s03 are split, and s00 sits in the class it is barred from.
const VIOLATED = {
  keepApart: [['s00', 's03']],
  keepTogether: [['s01', 's03']],
  keepOutOfClass: [{ studentId: 's00', classIndex: 0 }],
};

// The same constraint shapes, satisfied by that assignment.
const SATISFIED = {
  keepApart: [['s00', 's01']],
  keepTogether: [['s00', 's03']],
  keepOutOfClass: [{ studentId: 's00', classIndex: 1 }],
};

describe('computeCostTerms is computeCost, itemised', () => {
  test('plain roster: terms sum to the cost', () => {
    const students = roster();
    const assignment = roundRobin(students);
    const args = [students, assignment, 3, NUMERIC, FLAGS, [], [], [], []];

    const terms = computeCostTerms(...args);
    expect(sumTerms(terms)).toBe(computeCost(...args));
    expect(computeCost(...args)).toBeGreaterThan(0);
  });

  test('all three constraint types violated: terms sum to the cost', () => {
    const students = roster();
    const assignment = roundRobin(students);
    const args = [
      students,
      assignment,
      3,
      NUMERIC,
      FLAGS,
      VIOLATED.keepApart,
      VIOLATED.keepTogether,
      VIOLATED.keepOutOfClass,
      [],
    ];

    const terms = computeCostTerms(...args);
    expect(sumTerms(terms)).toBe(computeCost(...args));
  });

  test('category criteria present: terms sum to the cost', () => {
    const students = roster();
    const assignment = roundRobin(students);
    const args = [students, assignment, 3, NUMERIC, FLAGS, [], [], [], CATEGORIES];

    const terms = computeCostTerms(...args);
    expect(sumTerms(terms)).toBe(computeCost(...args));
    const category = terms.find(t => t.id === 'category:priorClass');
    expect(category.cost).toBeGreaterThan(0);
  });

  test('zero-variance numeric criterion contributes exactly 0 and never NaN', () => {
    const students = roster().map(s => ({ ...s, reading: 50 }));
    const assignment = roundRobin(students);
    const args = [
      students,
      assignment,
      3,
      [{ key: 'reading', label: 'Reading', weight: 1 }],
      [],
      [],
      [],
      [],
      [],
    ];

    const terms = computeCostTerms(...args);
    const reading = terms.find(t => t.id === 'numeric:reading');
    expect(reading).toBeDefined();
    expect(reading.cost).toBe(0);
    expect(Number.isFinite(reading.cost)).toBe(true);
    expect(sumTerms(terms)).toBe(computeCost(...args));
  });

  test('single-valued category contributes exactly 0 and never NaN', () => {
    const students = roster().map(s => ({ ...s, priorClass: 'Room 1' }));
    const assignment = roundRobin(students);
    const args = [students, assignment, 3, NUMERIC, [], [], [], [], CATEGORIES];

    const terms = computeCostTerms(...args);
    const category = terms.find(t => t.id === 'category:priorClass');
    expect(category).toBeDefined();
    expect(category.cost).toBe(0);
    expect(Number.isFinite(category.cost)).toBe(true);
    expect(sumTerms(terms)).toBe(computeCost(...args));
  });

  test('empty roster returns no terms and a zero cost', () => {
    const args = [[], {}, 3, NUMERIC, FLAGS, [], [], [], CATEGORIES];
    expect(computeCostTerms(...args)).toEqual([]);
    expect(computeCost(...args)).toBe(0);
  });

  test('every term cost is a finite, non-negative number in every scenario', () => {
    const students = roster();
    const assignment = roundRobin(students);
    const scenarios = [
      [students, assignment, 3, NUMERIC, FLAGS, [], [], [], []],
      [
        students,
        assignment,
        3,
        NUMERIC,
        FLAGS,
        VIOLATED.keepApart,
        VIOLATED.keepTogether,
        VIOLATED.keepOutOfClass,
        [],
      ],
      [students, assignment, 3, NUMERIC, FLAGS, [], [], [], CATEGORIES],
    ];

    for (const args of scenarios) {
      for (const term of computeCostTerms(...args)) {
        expect(Number.isFinite(term.cost)).toBe(true);
        expect(term.cost).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('term identity', () => {
  const students = roster();
  const assignment = roundRobin(students);
  const terms = computeCostTerms(
    students,
    assignment,
    3,
    NUMERIC,
    FLAGS,
    VIOLATED.keepApart,
    VIOLATED.keepTogether,
    VIOLATED.keepOutOfClass,
    CATEGORIES
  );
  const byId = new Map(terms.map(t => [t.id, t]));

  test('one term per configured criterion, plus the fixed terms, in accumulation order', () => {
    expect(terms.map(t => t.id)).toEqual([
      'numeric:reading',
      'numeric:math',
      'flag:iep',
      'category:priorClass',
      'gender',
      'totalFlags',
      'totalScore',
      'classSize',
      'keepApart',
      'keepTogether',
      'keepOutOfClass',
    ]);
  });

  test('labels come from the criterion and the fixed terms are named', () => {
    expect(byId.get('numeric:reading').label).toBe('Reading');
    expect(byId.get('numeric:math').label).toBe('Math');
    expect(byId.get('flag:iep').label).toBe('IEP');
    expect(byId.get('category:priorClass').label).toBe('Current Class');
    expect(byId.get('gender').label).toBe('Gender balance');
    expect(byId.get('totalFlags').label).toBe('Total flags balance');
    expect(byId.get('totalScore').label).toBe('Total score balance');
    expect(byId.get('classSize').label).toBe('Class size balance');
    expect(byId.get('keepApart').label).toBe('Keep apart penalty');
    expect(byId.get('keepTogether').label).toBe('Keep together penalty');
    expect(byId.get('keepOutOfClass').label).toBe('Keep out of class penalty');
  });

  test('a criterion with no label falls back to its key', () => {
    const unlabelled = computeCostTerms(
      students,
      assignment,
      3,
      [{ key: 'reading', weight: 1 }],
      [{ key: 'iep', weight: 1 }],
      [],
      [],
      [],
      [{ key: 'priorClass', weight: 1 }]
    );
    const labels = new Map(unlabelled.map(t => [t.id, t.label]));
    expect(labels.get('numeric:reading')).toBe('reading');
    expect(labels.get('flag:iep')).toBe('iep');
    expect(labels.get('category:priorClass')).toBe('priorClass');
  });

  test('criteria are balance terms; the three constraints are penalties', () => {
    for (const id of [
      'numeric:reading',
      'flag:iep',
      'category:priorClass',
      'gender',
      'totalFlags',
      'totalScore',
      'classSize',
    ]) {
      expect(byId.get(id).kind).toBe('balance');
    }
    for (const id of ['keepApart', 'keepTogether', 'keepOutOfClass']) {
      expect(byId.get(id).kind).toBe('penalty');
    }
  });
});

describe('constraint penalties', () => {
  const students = roster();
  const assignment = roundRobin(students);

  test('violated constraints carry cost', () => {
    const terms = computeCostTerms(
      students,
      assignment,
      3,
      NUMERIC,
      FLAGS,
      VIOLATED.keepApart,
      VIOLATED.keepTogether,
      VIOLATED.keepOutOfClass,
      []
    );
    expect(terms.find(t => t.id === 'keepApart').cost).toBeGreaterThan(0);
    expect(terms.find(t => t.id === 'keepTogether').cost).toBeGreaterThan(0);
    expect(terms.find(t => t.id === 'keepOutOfClass').cost).toBeGreaterThan(0);
  });

  test('satisfied constraints cost nothing', () => {
    const terms = computeCostTerms(
      students,
      assignment,
      3,
      NUMERIC,
      FLAGS,
      SATISFIED.keepApart,
      SATISFIED.keepTogether,
      SATISFIED.keepOutOfClass,
      []
    );
    expect(terms.find(t => t.id === 'keepApart').cost).toBe(0);
    expect(terms.find(t => t.id === 'keepTogether').cost).toBe(0);
    expect(terms.find(t => t.id === 'keepOutOfClass').cost).toBe(0);
  });
});

describe('the assessment carries the same itemisation', () => {
  test('costTerms sum to the reported currentCost', async () => {
    const students = roster(27);
    const assignment = roundRobin(students);
    const result = await runFullAssessment({
      students,
      assignment,
      numClasses: 3,
      numericCriteria: NUMERIC,
      flagCriteria: FLAGS,
      categoryCriteria: CATEGORIES,
    });

    expect(result.ready).toBe(true);
    expect(Array.isArray(result.costTerms)).toBe(true);
    expect(result.costTerms.length).toBeGreaterThan(0);
    // Both sides are rounded to 5 decimals for display; anything beyond float
    // rounding here would mean the breakdown explains a different number.
    expect(result.currentCost).toBeCloseTo(sumTerms(result.costTerms), 5);
  });
});

describe('rankCostTerms', () => {
  const terms = [
    { id: 'a', label: 'A', kind: 'balance', cost: 0.5 },
    { id: 'b', label: 'B', kind: 'penalty', cost: 0 },
    { id: 'c', label: 'C', kind: 'balance', cost: 1.5 },
    { id: 'd', label: 'D', kind: 'balance', cost: 2 },
  ];

  test('sorted largest first, zero terms dropped', () => {
    expect(rankCostTerms(terms).map(t => t.id)).toEqual(['d', 'c', 'a']);
  });

  test('percentages are whole numbers reflecting each share', () => {
    const ranked = rankCostTerms(terms);
    expect(ranked.map(t => t.percent)).toEqual([50, 38, 13]);
    for (const term of ranked) {
      expect(Number.isInteger(term.percent)).toBe(true);
    }
  });

  test('an all-zero or empty list yields no rows', () => {
    expect(rankCostTerms([])).toEqual([]);
    expect(rankCostTerms([{ id: 'a', label: 'A', kind: 'balance', cost: 0 }])).toEqual([]);
    expect(rankCostTerms(undefined)).toEqual([]);
  });

  test('no NaN percentage is produced when the total cannot be divided by', () => {
    const ranked = rankCostTerms([{ id: 'a', label: 'A', kind: 'balance', cost: 0 }]);
    expect(ranked.every(t => Number.isFinite(t.percent))).toBe(true);
    // A non-numeric input must not leak NaN into a rendered row either.
    for (const term of rankCostTerms(terms)) {
      expect(Number.isFinite(term.percent)).toBe(true);
    }
  });
});

describe('the score describes the students it counts (#103)', () => {
  /**
   * An unplaced student used to change the score without changing a class:
   * every baseline in `computeCostTerms` ran over the roster while the classes
   * held only placed students, so removing one student from the plan moved the
   * population mean, its variance and the expected class size. The teacher saw
   * the same two columns and a different number, which is the one thing a
   * balance score cannot do.
   *
   * The fixed contract: every baseline is computed from placed students, so the
   * score for a set of classes is the same whether or not an unplaced student
   * happens to be in the roster.
   */
  const args = (students, assignment) => [students, assignment, 3, NUMERIC, FLAGS, [], [], [], CATEGORIES];

  /** Two classes of placed students, plus one student in no class. */
  function partialRoster() {
    const students = roster();
    return { students, assignment: roundRobin(students).valueOf(), unplaced: students[0] };
  }

  test('an unplaced student moves no term cost', () => {
    const { students } = partialRoster();
    const placedStudents = students.slice(1); // leave students[0] unplaced
    const assignment = {};
    placedStudents.forEach((s, i) => {
      assignment[s.id] = i % 3;
    });

    // Same classes, same assignment, roster includes the unplaced student.
    const withUnplaced = computeCostTerms(...args(students, assignment));
    // Same classes, same assignment, unplaced student removed from the roster.
    const withoutUnplaced = computeCostTerms(...args(placedStudents, assignment));

    expect(withUnplaced.map(t => t.id)).toEqual(withoutUnplaced.map(t => t.id));
    expect(withUnplaced.map(t => t.cost)).toEqual(withoutUnplaced.map(t => t.cost));
  });

  test('an unplaced student cannot change the score a teacher sees', () => {
    const { students } = partialRoster();
    const placedStudents = students.slice(1);
    const assignment = {};
    placedStudents.forEach((s, i) => {
      assignment[s.id] = i % 3;
    });

    const withUnplaced = computeCost(...args(students, assignment));
    const withoutUnplaced = computeCost(...args(placedStudents, assignment));

    expect(withUnplaced).toBe(withoutUnplaced);
  });

  test('the class-size term counts placed students, not the roster', () => {
    // Four students, two classes, one unplaced: the real sizes are 2 and 1
    // against an expected 1.5, not against an expected 2.
    const students = [
      { id: 'a', name: 'A', gender: 'F', reading: 90, math: 60, iep: false, priorClass: 'Room 1' },
      { id: 'b', name: 'B', gender: 'M', reading: 80, math: 70, iep: false, priorClass: 'Room 1' },
      { id: 'c', name: 'C', gender: 'F', reading: 70, math: 80, iep: false, priorClass: 'Room 1' },
      { id: 'd', name: 'D', gender: 'M', reading: 20, math: 30, iep: false, priorClass: 'Room 1' },
    ];
    const assignment = { a: 0, b: 0, c: 1 };

    const terms = computeCostTerms(students, assignment, 2, NUMERIC, FLAGS, [], [], [], CATEGORIES);
    const classSize = terms.find(t => t.id === 'classSize');
    const sizes = [2, 1];
    const meanSize = 3 / 2;
    const expected = 3.0 * (sizes.reduce((sum, sz) => sum + (sz - meanSize) ** 2, 0) / 2) / meanSize ** 2;

    expect(classSize.cost).toBeCloseTo(expected, 10);
    expect(classSize.cost).toBeGreaterThan(0);
  });

  test('the reported score matches the score of the classes it describes', () => {
    // The repro from the issue: four students, two classes, one left out.
    const students = [
      { id: 'a', name: 'A', gender: 'F', reading: 90, math: 60, iep: false, priorClass: 'Room 1' },
      { id: 'b', name: 'B', gender: 'M', reading: 80, math: 70, iep: false, priorClass: 'Room 1' },
      { id: 'c', name: 'C', gender: 'F', reading: 70, math: 80, iep: false, priorClass: 'Room 2' },
      { id: 'd', name: 'D', gender: 'M', reading: 20, math: 30, iep: false, priorClass: 'Room 2' },
    ];
    const twoClasses = { a: 0, b: 0, c: 1, d: 1 };
    const oneUnplaced = { a: 0, b: 0, c: 1 };

    // Two classes of two is not the same plan as two classes of two-and-one;
    // what must not happen is the score changing for the *same* classes.
    const placedOnly = students.filter(s => oneUnplaced[s.id] !== undefined);
    expect(computeCost(...args(students, oneUnplaced))).toBe(computeCost(...args(placedOnly, oneUnplaced)));
    expect(computeCost(...args(students, twoClasses))).not.toBe(computeCost(...args(students, oneUnplaced)));
  });

  test('nothing placed returns terms that are finite zeros, never NaN', () => {
    const students = roster();
    const terms = computeCostTerms(...args(students, {}));
    expect(terms.length).toBeGreaterThan(0);
    for (const term of terms) {
      expect(Number.isFinite(term.cost)).toBe(true);
      expect(term.cost).toBe(0);
    }
    expect(computeCost(...args(students, {}))).toBe(0);
  });
});
