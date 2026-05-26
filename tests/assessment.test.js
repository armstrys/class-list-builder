import { describe, test, expect, beforeEach, vi } from 'vitest';
import { computeClassStats, computeBaselineBalanced, computeBaselineRandom, runFullAssessment, normalizeBalanceScore } from '../src/utils/assessment.js';
import { computeCost, optimize } from '../src/optimizer.js';

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

      // Run two sets of 100 trials
      const cost1 = computeBaselineRandom(students, 3, numericCriteria, flagCriteria, 100);
      const cost2 = computeBaselineRandom(students, 3, numericCriteria, flagCriteria, 100);

      // Both should be positive
      expect(cost1).toBeGreaterThan(0);
      expect(cost2).toBeGreaterThan(0);

      // With 100 trials, means should be within 20% of each other
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
});
