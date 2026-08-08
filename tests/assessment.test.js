import { describe, test, expect, beforeEach, vi } from 'vitest';
import { computeClassStats, computeBaselineBalanced, computeBaselineRandom, runFullAssessment, normalizeBalanceScore } from '../src/utils/assessment.js';
import { computeCost, optimize, optimizeMultiStart, OPTIMIZE_RESTARTS } from '../src/optimizer.js';

// Test helpers
let idCounter = 0;
function uid() {
  idCounter++;
  return `test-student-${idCounter}`;
}

function resetIdCounter() {
  idCounter = 0;
}

// Deterministic mock for Math.random — returns values from a sequence
function createMockRandom(sequence) {
  let idx = 0;
  return () => {
    const val = sequence[idx % sequence.length];
    idx++;
    return val;
  };
}

// Seeded PRNG (Mulberry32, same generator the optimizer uses) for tests that
// need *varied* draws rather than a short repeating sequence, but still need
// to be reproducible. createMockRandom cycles a fixed list, which would make
// two sampling runs identical and the comparison vacuous.
function createSeededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Assessment Engine', () => {
  beforeEach(() => {
    resetIdCounter();
    vi.restoreAllMocks();
  });

  const numericCriteria = [
    { key: 'readingScore', label: 'Reading Score', weight: 1.0 },
    { key: 'mathScore', label: 'Math Score', weight: 1.0 },
  ];

  const flagCriteria = [
    { key: 'behavior', label: 'Behavior', weight: 1.0 },
    { key: 'sped', label: 'SPED', weight: 1.0 },
  ];

  describe('computeClassStats', () => {
    test('computes per-class means for numeric criteria', () => {
      const students = [
        { id: uid(), name: 'Alice', gender: 'F', readingScore: 100, mathScore: 2000, behavior: false, sped: false },
        { id: uid(), name: 'Bob', gender: 'M', readingScore: 200, mathScore: 2500, behavior: true, sped: false },
        { id: uid(), name: 'Charlie', gender: 'M', readingScore: 150, mathScore: 2200, behavior: false, sped: true },
        { id: uid(), name: 'Diana', gender: 'F', readingScore: 180, mathScore: 2400, behavior: true, sped: true },
      ];

      const assignment = {
        [students[0].id]: 0,
        [students[1].id]: 0,
        [students[2].id]: 1,
        [students[3].id]: 1,
      };

      const stats = computeClassStats(students, assignment, 2, numericCriteria, flagCriteria);

      expect(stats).toHaveLength(2);

      // Class 0: Alice (100, 2000), Bob (200, 2500)
      const class0 = stats[0];
      expect(class0.studentCount).toBe(2);
      expect(class0.mCount).toBe(1);
      expect(class0.fCount).toBe(1);

      const reading0 = class0.numericStats.find(s => s.key === 'readingScore');
      expect(reading0.mean).toBe(150); // (100 + 200) / 2

      const math0 = class0.numericStats.find(s => s.key === 'mathScore');
      expect(math0.mean).toBe(2250); // (2000 + 2500) / 2

      // Class 1: Charlie (150, 2200), Diana (180, 2400)
      const class1 = stats[1];
      expect(class1.studentCount).toBe(2);

      const reading1 = class1.numericStats.find(s => s.key === 'readingScore');
      expect(reading1.mean).toBe(165); // (150 + 180) / 2

      const math1 = class1.numericStats.find(s => s.key === 'mathScore');
      expect(math1.mean).toBe(2300); // (2200 + 2400) / 2
    });

    test('computes flag rates as means', () => {
      const students = [
        { id: uid(), name: 'Alice', gender: 'F', readingScore: 100, mathScore: 2000, behavior: true, sped: false },
        { id: uid(), name: 'Bob', gender: 'M', readingScore: 200, mathScore: 2500, behavior: true, sped: true },
        { id: uid(), name: 'Charlie', gender: 'M', readingScore: 150, mathScore: 2200, behavior: false, sped: false },
      ];

      const assignment = {
        [students[0].id]: 0,
        [students[1].id]: 0,
        [students[2].id]: 1,
      };

      const stats = computeClassStats(students, assignment, 2, numericCriteria, flagCriteria);

      // Class 0: Alice (behavior=true), Bob (behavior=true, sped=true)
      const class0 = stats[0];
      const behavior0 = class0.flagStats.find(s => s.key === 'behavior');
      expect(behavior0.mean).toBe(1); // 2/2 = 1.0
      expect(behavior0.count).toBe(2);

      const sped0 = class0.flagStats.find(s => s.key === 'sped');
      expect(sped0.mean).toBe(0.5); // 1/2 = 0.5
      expect(sped0.count).toBe(1);

      // Class 1: Charlie (no flags)
      const class1 = stats[1];
      const behavior1 = class1.flagStats.find(s => s.key === 'behavior');
      expect(behavior1.mean).toBe(0);
      expect(behavior1.count).toBe(0);
    });

    test('handles empty classes', () => {
      const students = [
        { id: uid(), name: 'Alice', gender: 'F', readingScore: 100, mathScore: 2000, behavior: false, sped: false },
      ];

      const assignment = {
        [students[0].id]: 0,
      };

      const stats = computeClassStats(students, assignment, 2, numericCriteria, flagCriteria);

      expect(stats[0].studentCount).toBe(1);
      expect(stats[1].studentCount).toBe(0);
      expect(stats[1].numericStats[0].mean).toBe(0);
      expect(stats[1].flagStats[0].mean).toBe(0);
    });
  });

  describe('computeBaselineBalanced', () => {
    test('produces lower cost than round-robin assignment', () => {
      // Create students with clear score differences
      const students = [];
      for (let i = 0; i < 30; i++) {
        students.push({
          id: uid(),
          name: `Student ${i}`,
          gender: i % 2 === 0 ? 'F' : 'M',
          readingScore: 50 + (i % 10) * 20, // 50, 70, 90, ... 230
          mathScore: 2000 + (i % 10) * 100, // 2000, 2100, ... 2900
          behavior: i % 5 === 0,
          sped: i % 7 === 0,
        });
      }

      // Round-robin assignment
      const roundRobinAssignment = {};
      students.forEach((s, i) => {
        roundRobinAssignment[s.id] = i % 3;
      });
      const roundRobinCost = computeCost(students, roundRobinAssignment, 3, numericCriteria, flagCriteria, [], [], []);

      // Optimized assignment (no constraints)
      const balancedCost = computeBaselineBalanced(students, 3, numericCriteria, flagCriteria);

      // Optimizer should do at least as well as round-robin
      expect(balancedCost).toBeLessThanOrEqual(roundRobinCost);
      expect(balancedCost).toBeGreaterThan(0);
    });

    test('returns 0 for empty students', () => {
      const cost = computeBaselineBalanced([], 3, numericCriteria, flagCriteria);
      expect(cost).toBe(0);
    });

    test('is deterministic across calls with the same inputs', () => {
      // Arrange — the multi-restart loop walks salts 0..N-1 in order, so two
      // calls with identical inputs must produce byte-identical cost.
      const students = [];
      for (let i = 0; i < 30; i++) {
        students.push({
          id: uid(),
          name: `S${i}`,
          gender: i % 2 === 0 ? 'F' : 'M',
          readingScore: 50 + (i % 10) * 20,
          mathScore: 2000 + (i % 10) * 100,
          behavior: i % 5 === 0,
          sped: i % 7 === 0,
        });
      }

      // Act
      const a = computeBaselineBalanced(students, 3, numericCriteria, flagCriteria);
      const b = computeBaselineBalanced(students, 3, numericCriteria, flagCriteria);

      // Assert
      expect(a).toBe(b);
    });

    test('multi-restart cost is no worse than single-restart cost', () => {
      // Arrange — the whole point of multi-restart is that taking the min
      // across N independent SA trajectories produces a baseline ≤ any
      // individual run. We assert restarts=5 is ≤ restarts=1.
      const students = [];
      for (let i = 0; i < 30; i++) {
        students.push({
          id: uid(),
          name: `S${i}`,
          gender: i % 2 === 0 ? 'F' : 'M',
          readingScore: 50 + (i % 10) * 20,
          mathScore: 2000 + (i % 10) * 100,
          behavior: i % 5 === 0,
          sped: i % 7 === 0,
        });
      }

      // Act
      const single = computeBaselineBalanced(students, 3, numericCriteria, flagCriteria, 1);
      const multi = computeBaselineBalanced(students, 3, numericCriteria, flagCriteria, 5);

      // Assert
      expect(multi).toBeLessThanOrEqual(single);
    });

    test('restarts=1 with default salt matches the legacy single-run behavior', () => {
      // Arrange — backward-compat: a 1-restart baseline (salt=0) should
      // match a direct optimize() + computeCost() call with no salt.
      const students = [];
      for (let i = 0; i < 20; i++) {
        students.push({
          id: uid(),
          name: `S${i}`,
          gender: i % 2 === 0 ? 'F' : 'M',
          readingScore: 50 + (i % 10) * 20,
          mathScore: 2000 + (i % 10) * 100,
          behavior: i % 5 === 0,
          sped: i % 7 === 0,
        });
      }

      // Act
      const baseline = computeBaselineBalanced(students, 3, numericCriteria, flagCriteria, 1);
      const a = optimize(students, 3, {}, numericCriteria, flagCriteria, [], [], []);
      const directCost = computeCost(students, a, 3, numericCriteria, flagCriteria, [], [], []);

      // Assert
      expect(baseline).toBeCloseTo(directCost, 10);
    });
  });

  describe('normalizeBalanceScore', () => {
    let warnSpy;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    test('returns 100 when current equals balanced', () => {
      const { score, effectiveBalancedCost } = normalizeBalanceScore({
        currentCost: 0.01,
        balancedCost: 0.01,
        randomCost: 1.0,
      });

      expect(score).toBe(100);
      expect(effectiveBalancedCost).toBe(0.01);
    });

    test('returns 0 when current equals random', () => {
      const { score } = normalizeBalanceScore({
        currentCost: 1.0,
        balancedCost: 0.0,
        randomCost: 1.0,
      });

      expect(score).toBe(0);
    });

    test('produces intermediate scores between the two extremes', () => {
      const { score } = normalizeBalanceScore({
        currentCost: 0.5,
        balancedCost: 0.0,
        randomCost: 1.0,
      });

      // Power-law p=0.35: normalized=0.5 → 1 - 0.5^0.35 ≈ 0.215, score ≈ 21.5
      expect(score).toBeGreaterThan(15);
      expect(score).toBeLessThan(30);
    });

    test('defensive floor: applies when current < balanced', () => {
      // Arrange — simulates the SA baseline getting stuck at a worse local
      // minimum than the user's constrained current assignment.
      const { score, effectiveBalancedCost } = normalizeBalanceScore({
        currentCost: 0.005,
        balancedCost: 0.007,
        randomCost: 1.0,
      });

      // Assert — baseline floored to current, score caps at 100.
      expect(effectiveBalancedCost).toBe(0.005);
      expect(score).toBe(100);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/beat the baseline/);
    });

    test('defensive floor: does NOT trigger when current == balanced', () => {
      // Arrange — equality is the boundary; the floor is only meaningful
      // when current is strictly less than balanced.
      normalizeBalanceScore({
        currentCost: 0.01,
        balancedCost: 0.01,
        randomCost: 1.0,
      });

      // Assert — no warning issued.
      expect(warnSpy).not.toHaveBeenCalled();
    });

    test('defensive floor: does NOT trigger when current > balanced (normal case)', () => {
      // Arrange
      const { score, effectiveBalancedCost } = normalizeBalanceScore({
        currentCost: 0.02,
        balancedCost: 0.01,
        randomCost: 1.0,
      });

      // Assert — baseline unchanged, score computed normally.
      expect(effectiveBalancedCost).toBe(0.01);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThan(0);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    test('warns and returns 100 when balanced >= random (degenerate)', () => {
      const { score } = normalizeBalanceScore({
        currentCost: 0.5,
        balancedCost: 0.4,
        randomCost: 0.3, // intentionally lower than balanced
      });

      expect(score).toBe(100);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('computeBaselineRandom', () => {
    test('with deterministic random: produces expected cost', () => {
      // Mock Math.random to be deterministic
      const mockRandom = createMockRandom([0.1, 0.5, 0.9, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6]);
      const originalRandom = Math.random;
      Math.random = mockRandom;

      try {
        const students = [];
        for (let i = 0; i < 9; i++) {
          students.push({
            id: uid(),
            name: `Student ${i}`,
            gender: 'F',
            readingScore: 100 + i * 10,
            mathScore: 2000 + i * 50,
            behavior: false,
            sped: false,
          });
        }

        // With mocked random [0.1, 0.5, 0.9, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6]
        // and 3 classes: floor(random * 3) gives [0, 1, 2, 0, 2, 0, 2, 1, 1]
        const cost = computeBaselineRandom(students, 3, numericCriteria, flagCriteria, 1);

        expect(cost).toBeGreaterThan(0);
        expect(typeof cost).toBe('number');

        // Run again with same mock — should get identical cost
        resetIdCounter();
        const students2 = [];
        for (let i = 0; i < 9; i++) {
          students2.push({
            id: uid(),
            name: `Student ${i}`,
            gender: 'F',
            readingScore: 100 + i * 10,
            mathScore: 2000 + i * 50,
            behavior: false,
            sped: false,
          });
        }

        // Reset mock index
        Math.random = createMockRandom([0.1, 0.5, 0.9, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6]);
        const cost2 = computeBaselineRandom(students2, 3, numericCriteria, flagCriteria, 1);

        expect(cost).toBe(cost2);
      } finally {
        Math.random = originalRandom;
      }
    });

    test('returns 0 for empty students', () => {
      const cost = computeBaselineRandom([], 3, numericCriteria, flagCriteria, 10);
      expect(cost).toBe(0);
    });

    test('mean of many trials is stable', () => {
      const students = [];
      for (let i = 0; i < 30; i++) {
        students.push({
          id: uid(),
          name: `Student ${i}`,
          gender: i % 2 === 0 ? 'F' : 'M',
          readingScore: 50 + i * 10,
          mathScore: 2000 + i * 50,
          behavior: i % 5 === 0,
          sped: i % 7 === 0,
        });
      }

      // computeBaselineRandom draws from Math.random directly, so this
      // comparison is only reproducible if the stream is seeded. Left
      // unseeded at 100 trials it failed ~5.4% of runs (measured over 2000
      // repetitions: p50 0.069, p95 0.204, max 0.344) — which is why it
      // intermittently broke CI. Seeding fixes the draw; raising the trial
      // count keeps the assertion meaningful rather than merely lucky.
      const originalRandom = Math.random;
      let cost1, cost2;
      try {
        Math.random = createSeededRandom(12345);
        cost1 = computeBaselineRandom(students, 3, numericCriteria, flagCriteria, 500);
        cost2 = computeBaselineRandom(students, 3, numericCriteria, flagCriteria, 500);
      } finally {
        Math.random = originalRandom;
      }

      // Both should be positive
      expect(cost1).toBeGreaterThan(0);
      expect(cost2).toBeGreaterThan(0);

      // With 500 seeded trials the two means land 6.2% apart; unseeded, the
      // spread at this trial count stayed under 0.185 across 2000 runs.
      const diff = Math.abs(cost1 - cost2);
      const avg = (cost1 + cost2) / 2;
      expect(diff / avg).toBeLessThan(0.2);
    });
  });

  describe('runFullAssessment', () => {
    test('returns normalized score between 0 and 100 with real data', async () => {
      // Use a realistic class size: 27 students, 3 classes
      const students = [];
      for (let i = 0; i < 27; i++) {
        students.push({
          id: uid(),
          name: `Student ${i + 1}`,
          gender: i % 3 === 0 ? 'F' : i % 3 === 1 ? 'M' : 'U',
          readingScore: 50 + (i % 10) * 20,
          mathScore: 2000 + (i % 10) * 100,
          behavior: i % 4 === 0,
          sped: i % 6 === 0,
        });
      }

      // Run optimizer to get a real assignment
      const assignment = optimize(students, 3, {}, numericCriteria, flagCriteria, [], [], []);

      const result = await runFullAssessment({
        students,
        assignment,
        numClasses: 3,
        numericCriteria,
        flagCriteria,
      });

      expect(result.ready).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.currentCost).toBeGreaterThan(0);
      expect(result.balancedCost).toBeGreaterThan(0);
      expect(result.randomCost).toBeGreaterThan(0);
      expect(result.classStats).toHaveLength(3);

      // With real data, optimizer should beat random
      expect(result.balancedCost).toBeLessThan(result.randomCost);
    });

    test('perfect assignment scores 100', async () => {
      // Create students with identical scores — any assignment is perfect
      const students = [];
      for (let i = 0; i < 12; i++) {
        students.push({
          id: uid(),
          name: `Student ${i + 1}`,
          gender: 'F',
          readingScore: 100,
          mathScore: 2000,
          behavior: false,
          sped: false,
        });
      }

      // Any assignment is optimal when all students are identical
      const assignment = {};
      students.forEach((s, i) => {
        assignment[s.id] = i % 3;
      });

      const result = await runFullAssessment({
        students,
        assignment,
        numClasses: 3,
        numericCriteria,
        flagCriteria,
      });

      expect(result.ready).toBe(true);
      // When all students are identical, currentCost should equal balancedCost
      // Score should be 100 (or very close)
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test('violated constraints produce near-zero score', async () => {
      // Create students with keep-apart constraint that is violated
      const students = [];
      for (let i = 0; i < 27; i++) {
        students.push({
          id: uid(),
          name: `Student ${i + 1}`,
          gender: i % 3 === 0 ? 'F' : i % 3 === 1 ? 'M' : 'U',
          readingScore: 50 + (i % 10) * 20,
          mathScore: 2000 + (i % 10) * 100,
          behavior: i % 4 === 0,
          sped: i % 6 === 0,
        });
      }

      // Put students 0 and 1 in same class (they should be kept apart)
      const keepApart = [[students[0].id, students[1].id]];

      // Assignment that violates the constraint
      const assignment = {};
      students.forEach((s, i) => {
        assignment[s.id] = i % 3;
      });
      // Force violation: put student 0 and 1 in same class
      assignment[students[0].id] = 0;
      assignment[students[1].id] = 0;

      // Compute cost WITH constraints
      const constrainedCost = computeCost(students, assignment, 3, numericCriteria, flagCriteria, keepApart, [], []);

      // Compute cost WITHOUT constraints (for baselines)
      const unconstrainedCost = computeCost(students, assignment, 3, numericCriteria, flagCriteria, [], [], []);

      // With 10x penalty weights, constrained cost should be MUCH higher
      expect(constrainedCost).toBeGreaterThan(unconstrainedCost * 5);

      // Now run full assessment (baselines have no constraints, current has constraints)
      const result = await runFullAssessment({
        students,
        assignment,
        numClasses: 3,
        numericCriteria,
        flagCriteria,
        keepApart,
      });

      expect(result.ready).toBe(true);
      // With violated constraints, score should be very low (near 0)
      // because currentCost >> randomCost (which has no constraints)
      expect(result.score).toBeLessThan(10);
    });

    test('returns empty result for no students', async () => {
      const result = await runFullAssessment({
        students: [],
        assignment: {},
        numClasses: 3,
        numericCriteria,
        flagCriteria,
      });

      expect(result.ready).toBe(false);
      expect(result.score).toBe(0);
      expect(result.classStats).toHaveLength(0);
    });

    test('calls onProgress callback', async () => {
      const students = [
        { id: uid(), name: 'Alice', gender: 'F', readingScore: 100, mathScore: 2000, behavior: false, sped: false },
        { id: uid(), name: 'Bob', gender: 'M', readingScore: 200, mathScore: 2500, behavior: true, sped: false },
      ];

      const assignment = {
        [students[0].id]: 0,
        [students[1].id]: 1,
      };

      const progressCalls = [];
      const onProgress = (pct, msg) => {
        progressCalls.push({ pct, msg });
      };

      await runFullAssessment({
        students,
        assignment,
        numClasses: 2,
        numericCriteria,
        flagCriteria,
        onProgress,
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[progressCalls.length - 1].pct).toBe(100);
    });
  });

  // Regression guard for the v2.3.0 scoring bug: the balanced baseline runs
  // best-of-N restarts, but the app's Optimize button ran a single SA
  // trajectory (salt 0) — which the baseline also runs, plus N-1 more
  // chances to beat it. So `balancedCost <= currentCost` held by
  // construction, and with the p=0.35 power law a sub-1% gap cost 5-16
  // points. A freshly optimized, unconstrained assignment could only reach
  // 100 when salt 0 happened to win the restart lottery (~3 of 10 cohorts).
  // Fix: the app now runs the same best-of-N search via optimizeMultiStart.
  describe('Unconstrained optimize scores 100', () => {
    function cohort(n, seed) {
      const rnd = createSeededRandom(seed);
      return Array.from({ length: n }, (_, i) => ({
        id: `s-${seed}-${i}`,
        name: `Student ${i}`,
        gender: rnd() < 0.5 ? 'M' : 'F',
        readingScore: Math.round(40 + rnd() * 60),
        mathScore: Math.round(40 + rnd() * 60),
        behavior: rnd() < 0.15,
        sped: rnd() < 0.1,
      }));
    }

    test('multi-start assignment exactly ties the balanced baseline', () => {
      // Several cohorts: the single-run bug only surfaced on cohorts where
      // salt 0 lost the restart lottery, so one sample could pass by luck.
      for (const seed of [11, 22, 33, 44, 55]) {
        const students = cohort(60, seed);
        const numClasses = 3;

        const assignment = optimizeMultiStart(
          students, numClasses, {}, numericCriteria, flagCriteria
        );
        const currentCost = computeCost(
          students, assignment, numClasses, numericCriteria, flagCriteria, [], [], []
        );
        const balancedCost = computeBaselineBalanced(
          students, numClasses, numericCriteria, flagCriteria
        );

        expect(currentCost).toBeCloseTo(balancedCost, 12);

        const { score } = normalizeBalanceScore({
          currentCost,
          balancedCost,
          randomCost: balancedCost + 1, // any strictly positive range
        });
        expect(score).toBe(100);
      }
    });

    // F-005 (v3.1.0 audit): an unresolvable OPTIMIZE_RESTARTS made the
    // restart loop run zero iterations, so the baseline returned its
    // `Infinity` initializer; the defensive floor then reported a perfect
    // 100 for an arbitrary assignment. The baseline must fail closed.
    test('unusable restart counts throw instead of returning Infinity', () => {
      const students = cohort(20, 5);
      // Note: an explicit `undefined` resolves to the default parameter
      // (RESTARTS_REF), so it is not in this list. The guard's real job is
      // catching the case where RESTARTS_REF *itself* is undefined, which
      // arrives here as `restarts === undefined` via that same default.
      for (const bad of [NaN, 0, -1, Infinity, null, 'five']) {
        expect(() =>
          computeBaselineBalanced(students, 3, numericCriteria, flagCriteria, bad)
        ).toThrow(/positive finite number/);
      }
    });

    test('the baseline never returns a non-finite cost', () => {
      // Guards the consequence, not just the mechanism: Infinity is what the
      // defensive floor converted into a perfect score.
      const students = cohort(20, 6);
      const baseline = computeBaselineBalanced(students, 3, numericCriteria, flagCriteria);
      expect(Number.isFinite(baseline)).toBe(true);
    });

    test('baseline default restart count matches the optimizer constant', () => {
      const students = cohort(40, 99);
      const viaDefault = computeBaselineBalanced(students, 3, numericCriteria, flagCriteria);
      const viaExplicit = computeBaselineBalanced(
        students, 3, numericCriteria, flagCriteria, OPTIMIZE_RESTARTS
      );
      expect(viaDefault).toBe(viaExplicit);
    });

    test('a hand-degraded assignment still scores below 100', () => {
      // The fix must not flatten the scale into "always 100" — moving two
      // students between classes has to cost points.
      const students = cohort(60, 77);
      const numClasses = 3;
      const assignment = optimizeMultiStart(
        students, numClasses, {}, numericCriteria, flagCriteria
      );

      const degraded = { ...assignment };
      const moved = students.filter(s => degraded[s.id] !== 0).slice(0, 6);
      moved.forEach(s => { degraded[s.id] = 0; });

      const balancedCost = computeBaselineBalanced(
        students, numClasses, numericCriteria, flagCriteria
      );
      const degradedCost = computeCost(
        students, degraded, numClasses, numericCriteria, flagCriteria, [], [], []
      );

      expect(degradedCost).toBeGreaterThan(balancedCost);
      const { score } = normalizeBalanceScore({
        currentCost: degradedCost,
        balancedCost,
        randomCost: balancedCost + 1,
      });
      expect(score).toBeLessThan(100);
    });

    test('float noise below the equality epsilon does not deduct points', () => {
      const { score } = normalizeBalanceScore({
        currentCost: 0.003 + 1e-15,
        balancedCost: 0.003,
        randomCost: 0.5,
      });
      expect(score).toBe(100);
    });

    test('a real sub-1% gap still deducts meaningfully', () => {
      const balancedCost = 0.003;
      const randomCost = 0.5;
      const { score } = normalizeBalanceScore({
        currentCost: balancedCost + (randomCost - balancedCost) * 0.005,
        balancedCost,
        randomCost,
      });
      expect(score).toBeLessThan(90);
      expect(score).toBeGreaterThan(0);
    });
  });
});
