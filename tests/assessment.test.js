import { describe, test, expect, beforeEach } from 'vitest';
import { computeClassStats, computeBaselineRandom, runFullAssessment } from '../src/utils/assessment.js';
import { computeCost, optimize, computeAdaptiveAnnealingParams } from '../src/optimizer.js';

// Test helpers
let idCounter = 0;
function uid() {
  idCounter++;
  return `test-student-${idCounter}`;
}

function resetIdCounter() {
  idCounter = 0;
}

describe('Assessment Engine', () => {
  beforeEach(() => {
    resetIdCounter();
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

  describe('computeBaselineRandom', () => {
    test('returns a positive cost for random assignments', async () => {
      const students = [];
      for (let i = 0; i < 20; i++) {
        students.push({
          id: uid(),
          name: `Student ${i}`,
          gender: i % 2 === 0 ? 'F' : 'M',
          readingScore: 50 + i * 10,
          mathScore: 2000 + i * 50,
          behavior: i % 3 === 0,
          sped: i % 5 === 0,
        });
      }

      const randomCost = await computeBaselineRandom(students, 3, numericCriteria, flagCriteria, 50);

      expect(randomCost).toBeGreaterThan(0);
      expect(typeof randomCost).toBe('number');
    });

    test('returns 0 for empty students', () => {
      const cost = computeBaselineRandom([], 3, numericCriteria, flagCriteria, 10);
      expect(cost).toBe(0);
    });
  });

  describe('runFullAssessment', () => {
    test('returns normalized score between 0 and 100', async () => {
      const students = [];
      for (let i = 0; i < 20; i++) {
        students.push({
          id: uid(),
          name: `Student ${i}`,
          gender: i % 2 === 0 ? 'F' : 'M',
          readingScore: 50 + i * 10,
          mathScore: 2000 + i * 50,
          behavior: i % 3 === 0,
          sped: i % 5 === 0,
        });
      }

      // Create a balanced-ish assignment
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
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.currentCost).toBeGreaterThan(0);
      expect(result.balancedCost).toBeGreaterThan(0);
      expect(result.randomCost).toBeGreaterThan(0);
      expect(result.classStats).toHaveLength(3);

      // Balanced should be better (lower cost) than random
      expect(result.balancedCost).toBeLessThan(result.randomCost);
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
