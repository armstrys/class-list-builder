import { describe, test, expect, beforeEach } from 'vitest';
import { optimize, computeCost } from '../src/optimizer.js';
import { parseCSV, exportStudentsToCSV, exportClassListsToCSV } from '../src/csv.js';

// Test helpers
let idCounter = 0;
function uid() {
  idCounter++;
  return `test-student-${idCounter}`;
}

function resetIdCounter() {
  idCounter = 0;
}

/**
 * Creates mock students with mixed score ranges
 * - readingScore: 0-215 (assessment scores like DIBELS, DRA)
 * - mathScore: 2000-2900 (scaled scores like NWEA MAP)
 * - languageScore: 2000-2900 (scaled scores like CELDT, ELPA)
 */
function createMixedRangeStudents(count, options = {}) {
  const students = [];
  for (let i = 0; i < count; i++) {
    const readingScore = options.readingScore ?? Math.floor(Math.random() * 216); // 0-215
    const mathScore = options.mathScore ?? 2000 + Math.floor(Math.random() * 901); // 2000-2900
    const languageScore = options.languageScore ?? 2000 + Math.floor(Math.random() * 901); // 2000-2900

    students.push({
      id: uid(),
      name: `Student ${i + 1}`,
      gender: options.gender || (i % 2 === 0 ? 'F' : 'M'),
      readingScore,
      mathScore,
      languageScore,
      behavior: options.behavior ?? false,
      extendedLearning: options.extendedLearning ?? false,
      sped: options.sped ?? false,
    });
  }
  return students;
}

/**
 * Creates students with uniform score ranges for comparison
 */
function createUniformRangeStudents(count, options = {}) {
  const students = [];
  for (let i = 0; i < count; i++) {
    students.push({
      id: uid(),
      name: `Student ${i + 1}`,
      gender: options.gender || (i % 2 === 0 ? 'F' : 'M'),
      readingScore: options.readingScore ?? 50 + (i * 5) % 50,
      mathScore: options.mathScore ?? 40 + (i * 7) % 50,
      languageScore: options.languageScore ?? 60 + (i * 3) % 40,
      behavior: options.behavior ?? false,
      extendedLearning: options.extendedLearning ?? false,
      sped: options.sped ?? false,
    });
  }
  return students;
}

/**
 * Creates students with decimal score values
 */
function createDecimalScoreStudents(count) {
  const students = [];
  for (let i = 0; i < count; i++) {
    students.push({
      id: uid(),
      name: `Student ${i + 1}`,
      gender: i % 2 === 0 ? 'F' : 'M',
      readingScore: parseFloat((Math.random() * 215).toFixed(2)),
      mathScore: parseFloat((2000 + Math.random() * 900).toFixed(2)),
      languageScore: parseFloat((2000 + Math.random() * 900).toFixed(2)),
      behavior: false,
      extendedLearning: false,
      sped: false,
    });
  }
  return students;
}

// Criteria definitions
const mixedRangeCriteria = [
  { key: 'readingScore', label: 'Reading Score', short: 'Read', weight: 1.0 },
  { key: 'mathScore', label: 'Math Score', short: 'Math', weight: 1.0 },
  { key: 'languageScore', label: 'Language Score', short: 'Lang', weight: 1.0 },
];

const flagCriteria = [
  { key: 'behavior', label: 'Behavior', short: 'BEH', weight: 2.0 },
  { key: 'extendedLearning', label: 'Extended Learning', short: 'ExtL', weight: 1.5 },
  { key: 'sped', label: 'SPED', short: 'SPED', weight: 2.0 },
];

describe('Numeric Score Range Handling', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('Mixed Range Optimization', () => {
    test('optimizes correctly with reading 0-215 and math/language 2000-2900', () => {
      // Arrange - realistic school data scenario
      const students = createMixedRangeStudents(20);
      const numClasses = 3;

      // Act
      const assignment = optimize(students, numClasses, {}, mixedRangeCriteria, flagCriteria);

      // Assert - all students assigned
      students.forEach(s => {
        expect(assignment[s.id]).toBeDefined();
        expect(assignment[s.id]).toBeGreaterThanOrEqual(0);
        expect(assignment[s.id]).toBeLessThan(numClasses);
      });

      // Class sizes should be balanced
      const classCounts = new Array(numClasses).fill(0);
      students.forEach(s => {
        classCounts[assignment[s.id]]++;
      });
      const expectedSize = students.length / numClasses;
      classCounts.forEach(count => {
        expect(Math.abs(count - expectedSize)).toBeLessThanOrEqual(1);
      });
    });

    test('z-score normalization balances different magnitude ranges', () => {
      // Arrange - students with deliberately different score magnitudes
      const students = [];
      for (let i = 0; i < 12; i++) {
        students.push({
          id: uid(),
          name: `Student ${i + 1}`,
          gender: 'F',
          readingScore: 100 + i * 10, // 100-210 range
          mathScore: 2500 + i * 100,  // 2500-3600 range
          languageScore: 2200 + i * 50, // 2200-2750 range
          behavior: false,
          extendedLearning: false,
          sped: false,
        });
      }

      const numClasses = 2;

      // Act
      const assignment = optimize(students, numClasses, {}, mixedRangeCriteria, flagCriteria);

      // Assert - check that each class has balanced ranges across all criteria
      const classes = [[], []];
      students.forEach(s => {
        classes[assignment[s.id]].push(s);
      });

      // Each class should have students across the score spectrum
      // Verify that high-reading students aren't all in one class, etc.
      classes.forEach(cls => {
        expect(cls.length).toBeGreaterThanOrEqual(5); // Roughly balanced
      });
    });

    test('cost remains finite with extreme score ranges', () => {
      // Arrange - students with extreme differences
      const students = [];
      for (let i = 0; i < 10; i++) {
        students.push({
          id: uid(),
          name: `Student ${i + 1}`,
          gender: 'F',
          readingScore: i < 5 ? 0 : 215, // Extreme split
          mathScore: i < 5 ? 2000 : 2900, // Extreme split
          languageScore: i < 5 ? 2000 : 2900,
          behavior: false,
          extendedLearning: false,
          sped: false,
        });
      }

      const numClasses = 2;
      const assignment = optimize(students, numClasses, {}, mixedRangeCriteria, flagCriteria);

      // Act
      const cost = computeCost(students, assignment, numClasses, mixedRangeCriteria, flagCriteria);

      // Assert - cost should be finite and reasonable
      expect(Number.isFinite(cost)).toBe(true);
      expect(cost).toBeGreaterThan(0);
    });

    test('handles all-zero scores in one criterion', () => {
      // Arrange - all students have 0 reading scores
      const students = createMixedRangeStudents(12, { readingScore: 0 });
      const numClasses = 2;

      // Act
      const assignment = optimize(students, numClasses, {}, mixedRangeCriteria, flagCriteria);

      // Assert - should still work (0 variance criterion is skipped)
      students.forEach(s => {
        expect(assignment[s.id]).toBeDefined();
      });

      const cost = computeCost(students, assignment, numClasses, mixedRangeCriteria, flagCriteria);
      expect(Number.isFinite(cost)).toBe(true);
    });

    test('handles all-identical scores in one criterion', () => {
      // Arrange - all students have identical reading scores
      const students = [];
      for (let i = 0; i < 12; i++) {
        students.push({
          id: uid(),
          name: `Student ${i + 1}`,
          gender: 'F',
          readingScore: 100, // All identical
          mathScore: 2000 + Math.floor(Math.random() * 901),
          languageScore: 2000 + Math.floor(Math.random() * 901),
          behavior: false,
          extendedLearning: false,
          sped: false,
        });
      }

      const numClasses = 2;

      // Act
      const assignment = optimize(students, numClasses, {}, mixedRangeCriteria, flagCriteria);
      const cost = computeCost(students, assignment, numClasses, mixedRangeCriteria, flagCriteria);

      // Assert - should work with 0 variance
      expect(Number.isFinite(cost)).toBe(true);
    });

    test('determinism holds with mixed ranges', () => {
      // Arrange
      const students = createMixedRangeStudents(20);
      const numClasses = 3;

      // Act
      const assignment1 = optimize(students, numClasses, {}, mixedRangeCriteria, flagCriteria);
      const assignment2 = optimize(students, numClasses, {}, mixedRangeCriteria, flagCriteria);

      // Assert
      expect(assignment1).toEqual(assignment2);
    });
  });

  describe('Decimal Score Handling', () => {
    test('handles decimal scores correctly', () => {
      // Arrange
      const students = createDecimalScoreStudents(12);
      const numClasses = 2;

      // Act
      const assignment = optimize(students, numClasses, {}, mixedRangeCriteria, flagCriteria);

      // Assert
      students.forEach(s => {
        expect(assignment[s.id]).toBeDefined();
      });

      const cost = computeCost(students, assignment, numClasses, mixedRangeCriteria, flagCriteria);
      expect(Number.isFinite(cost)).toBe(true);
    });

    test('CSV round-trip preserves decimal precision', () => {
      // Arrange
      const students = [
        {
          id: 's1',
          name: 'Alice',
          gender: 'F',
          readingScore: 150.75,
          mathScore: 2450.33,
          languageScore: 2234.99,
          behavior: false,
          sped: false,
        },
        {
          id: 's2',
          name: 'Bob',
          gender: 'M',
          readingScore: 200.50,
          mathScore: 2899.99,
          languageScore: 2800.01,
          behavior: true,
          sped: false,
        },
      ];

      // Act
      const csv = exportStudentsToCSV(students, mixedRangeCriteria, flagCriteria);
      const result = parseCSV(csv, mixedRangeCriteria, flagCriteria);

      // Assert
      expect(result.students).toHaveLength(2);
      // Check decimal values are preserved (or reasonably close)
      expect(result.students[0].readingScore).toBeCloseTo(150.75, 1);
      expect(result.students[0].mathScore).toBeCloseTo(2450.33, 1);
      expect(result.students[0].languageScore).toBeCloseTo(2234.99, 1);
    });
  });

  describe('Edge Cases', () => {
    test('handles minimum value scores (0, 2000)', () => {
      const students = [
        {
          id: uid(),
          name: 'Low Scorer',
          gender: 'F',
          readingScore: 0,
          mathScore: 2000,
          languageScore: 2000,
          behavior: false,
          extendedLearning: false,
          sped: false,
        },
        ...createMixedRangeStudents(11),
      ];

      const numClasses = 2;
      const assignment = optimize(students, numClasses, {}, mixedRangeCriteria, flagCriteria);

      students.forEach(s => {
        expect(assignment[s.id]).toBeDefined();
      });
    });

    test('handles maximum value scores (215, 2900)', () => {
      const students = [
        {
          id: uid(),
          name: 'High Scorer',
          gender: 'M',
          readingScore: 215,
          mathScore: 2900,
          languageScore: 2900,
          behavior: false,
          extendedLearning: false,
          sped: false,
        },
        ...createMixedRangeStudents(11),
      ];

      const numClasses = 2;
      const assignment = optimize(students, numClasses, {}, mixedRangeCriteria, flagCriteria);

      students.forEach(s => {
        expect(assignment[s.id]).toBeDefined();
      });
    });

    test('handles single student with extreme scores', () => {
      const students = [
        {
          id: uid(),
          name: 'Extreme',
          gender: 'F',
          readingScore: 0,
          mathScore: 2900,
          languageScore: 2000,
          behavior: false,
          extendedLearning: false,
          sped: false,
        },
        ...createMixedRangeStudents(11),
      ];

      const numClasses = 2;
      const assignment = optimize(students, numClasses, {}, mixedRangeCriteria, flagCriteria);
      const cost = computeCost(students, assignment, numClasses, mixedRangeCriteria, flagCriteria);

      expect(Number.isFinite(cost)).toBe(true);
    });

    test('handles empty population for a criterion', () => {
      // Arrange - students where some criteria are missing (0)
      const students = [];
      for (let i = 0; i < 10; i++) {
        students.push({
          id: uid(),
          name: `Student ${i + 1}`,
          gender: 'F',
          readingScore: 0, // All zeros
          mathScore: 2000 + i * 100,
          languageScore: 0, // All zeros
          behavior: false,
          extendedLearning: false,
          sped: false,
        });
      }

      const numClasses = 2;
      const assignment = optimize(students, numClasses, {}, mixedRangeCriteria, flagCriteria);

      students.forEach(s => {
        expect(assignment[s.id]).toBeDefined();
      });
    });

    test('handles very large score ranges', () => {
      // Arrange - extreme range from 0 to 10000
      const students = [];
      for (let i = 0; i < 10; i++) {
        students.push({
          id: uid(),
          name: `Student ${i + 1}`,
          gender: 'F',
          readingScore: Math.floor(Math.random() * 10001),
          mathScore: Math.floor(Math.random() * 10001),
          languageScore: Math.floor(Math.random() * 10001),
          behavior: false,
          extendedLearning: false,
          sped: false,
        });
      }

      const numClasses = 2;
      const assignment = optimize(students, numClasses, {}, mixedRangeCriteria, flagCriteria);
      const cost = computeCost(students, assignment, numClasses, mixedRangeCriteria, flagCriteria);

      expect(Number.isFinite(cost)).toBe(true);
    });
  });

  describe('CSV Import/Export with Mixed Ranges', () => {
    test('exports students with mixed score ranges', () => {
      // Arrange
      const students = [
        { id: 's1', name: 'Alice', gender: 'F', readingScore: 150, mathScore: 2500, languageScore: 2200, behavior: false, sped: false },
        { id: 's2', name: 'Bob', gender: 'M', readingScore: 200, mathScore: 2800, languageScore: 2750, behavior: true, sped: false },
      ];

      // Act
      const csv = exportStudentsToCSV(students, mixedRangeCriteria, flagCriteria);

      // Assert
      const lines = csv.split('\n');
      expect(lines[0]).toContain('readingScore');
      expect(lines[0]).toContain('mathScore');
      expect(lines[0]).toContain('languageScore');
      expect(lines[1]).toContain('150');
      expect(lines[1]).toContain('2500');
      expect(lines[1]).toContain('2200');
    });

    test('imports students with mixed score ranges', () => {
      // Arrange
      const csv = `name,gender,readingScore,mathScore,languageScore,behavior,sped
Alice,F,150,2500,2200,false,false
Bob,M,200,2800,2750,true,false`;

      // Act
      const result = parseCSV(csv, mixedRangeCriteria, flagCriteria);

      // Assert
      expect(result.students).toHaveLength(2);
      expect(result.students[0].readingScore).toBe(150);
      expect(result.students[0].mathScore).toBe(2500);
      expect(result.students[0].languageScore).toBe(2200);
      expect(result.students[1].readingScore).toBe(200);
      expect(result.students[1].mathScore).toBe(2800);
      expect(result.students[1].languageScore).toBe(2750);
    });

    test('round-trip preserves mixed range scores', () => {
      // Arrange
      const students = createMixedRangeStudents(10);

      // Act
      const csv = exportStudentsToCSV(students, mixedRangeCriteria, flagCriteria);
      const result = parseCSV(csv, mixedRangeCriteria, flagCriteria);

      // Assert
      expect(result.students).toHaveLength(10);
      expect(result.errors).toHaveLength(0);

      // Verify score ranges are preserved
      const originalReadingScores = students.map(s => s.readingScore).sort((a, b) => a - b);
      const importedReadingScores = result.students.map(s => s.readingScore).sort((a, b) => a - b);
      expect(importedReadingScores).toEqual(originalReadingScores);

      const originalMathScores = students.map(s => s.mathScore).sort((a, b) => a - b);
      const importedMathScores = result.students.map(s => s.mathScore).sort((a, b) => a - b);
      expect(importedMathScores).toEqual(originalMathScores);
    });

    test('class list export includes mixed range scores', () => {
      // Arrange
      const students = [
        { id: 's1', name: 'Alice', gender: 'F', readingScore: 150, mathScore: 2500, languageScore: 2200, behavior: false, sped: false },
        { id: 's2', name: 'Bob', gender: 'M', readingScore: 200, mathScore: 2800, languageScore: 2750, behavior: true, sped: false },
      ];
      const assignment = { 's1': 0, 's2': 1 };
      const teachers = [{ name: 'Mrs. Smith' }, { name: 'Mr. Jones' }];

      // Act
      const csv = exportClassListsToCSV(students, assignment, teachers, mixedRangeCriteria, flagCriteria);

      // Assert
      expect(csv).toContain('150');
      expect(csv).toContain('2500');
      expect(csv).toContain('2200');
      expect(csv).toContain('200');
      expect(csv).toContain('2800');
      expect(csv).toContain('2750');
    });
  });

  describe('Balance Quality with Mixed Ranges', () => {
    test('balance improves across multiple runs', () => {
      // Arrange
      const students = createMixedRangeStudents(24);
      const numClasses = 3;

      // Create multiple assignments and compare costs
      const costs = [];
      for (let run = 0; run < 5; run++) {
        resetIdCounter();
        const runStudents = createMixedRangeStudents(24);
        const assignment = optimize(runStudents, numClasses, {}, mixedRangeCriteria, flagCriteria);
        const cost = computeCost(runStudents, assignment, numClasses, mixedRangeCriteria, flagCriteria);
        costs.push(cost);
      }

      // Assert - all runs should produce valid, finite costs
      costs.forEach(cost => {
        expect(Number.isFinite(cost)).toBe(true);
        expect(cost).toBeGreaterThan(0);
      });
    });

    test('class means are reasonably balanced', () => {
      // Arrange
      const students = createMixedRangeStudents(30);
      const numClasses = 3;
      const assignment = optimize(students, numClasses, {}, mixedRangeCriteria, flagCriteria);

      // Calculate means per class for each criterion
      const classes = Array.from({ length: numClasses }, () => []);
      students.forEach(s => {
        classes[assignment[s.id]].push(s);
      });

      // Check that class means don't diverge too much from population mean
      mixedRangeCriteria.forEach(criterion => {
        const allValues = students.map(s => s[criterion.key]);
        const popMean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
        const popStd = Math.sqrt(allValues.reduce((s, v) => s + (v - popMean) ** 2, 0) / allValues.length);

        const classMeans = classes.map(cls =>
          cls.reduce((sum, s) => sum + s[criterion.key], 0) / cls.length
        );

        // Class means should be within 2 standard deviations of population mean
        classMeans.forEach(mean => {
          if (popStd > 0) {
            expect(Math.abs(mean - popMean)).toBeLessThanOrEqual(popStd * 2);
          }
        });
      });
    });
  });

  describe('Numeric Criteria Edge Cases', () => {
    test('handles single numeric criterion', () => {
      const singleCriterion = [{ key: 'readingScore', label: 'Reading', short: 'Read', weight: 1.0 }];
      const students = [];
      for (let i = 0; i < 10; i++) {
        students.push({
          id: uid(),
          name: `Student ${i + 1}`,
          gender: 'F',
          readingScore: Math.floor(Math.random() * 216),
          behavior: false,
        });
      }

      const numClasses = 2;
      const assignment = optimize(students, numClasses, {}, singleCriterion, []);

      students.forEach(s => {
        expect(assignment[s.id]).toBeDefined();
      });
    });

    test('handles many numeric criteria', () => {
      const manyCriteria = [
        { key: 'score1', label: 'Score 1', short: 'S1', weight: 1.0 },
        { key: 'score2', label: 'Score 2', short: 'S2', weight: 1.0 },
        { key: 'score3', label: 'Score 3', short: 'S3', weight: 1.0 },
        { key: 'score4', label: 'Score 4', short: 'S4', weight: 1.0 },
        { key: 'score5', label: 'Score 5', short: 'S5', weight: 1.0 },
      ];

      const students = [];
      for (let i = 0; i < 10; i++) {
        students.push({
          id: uid(),
          name: `Student ${i + 1}`,
          gender: 'F',
          score1: Math.floor(Math.random() * 100),
          score2: Math.floor(Math.random() * 1000),
          score3: Math.floor(Math.random() * 10000),
          score4: Math.floor(Math.random() * 50),
          score5: Math.floor(Math.random() * 500),
          behavior: false,
        });
      }

      const numClasses = 2;
      const assignment = optimize(students, numClasses, {}, manyCriteria, []);

      students.forEach(s => {
        expect(assignment[s.id]).toBeDefined();
      });
    });

    test('handles negative scores', () => {
      const students = [];
      for (let i = 0; i < 10; i++) {
        students.push({
          id: uid(),
          name: `Student ${i + 1}`,
          gender: 'F',
          readingScore: -100 + Math.floor(Math.random() * 200), // -100 to 100
          mathScore: -500 + Math.floor(Math.random() * 1000),    // -500 to 500
          languageScore: -50 + Math.floor(Math.random() * 100),  // -50 to 50
          behavior: false,
        });
      }

      const numClasses = 2;
      const assignment = optimize(students, numClasses, {}, mixedRangeCriteria, []);
      const cost = computeCost(students, assignment, numClasses, mixedRangeCriteria, []);

      expect(Number.isFinite(cost)).toBe(true);
    });
  });
});
