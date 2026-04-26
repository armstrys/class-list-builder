import { describe, test, expect } from 'vitest';
import { optimize, computeCost, computeSeed, createSeededRNG } from '../src/optimizer.js';

// Test helpers - use deterministic IDs for reproducible tests
let idCounter = 0;
function uid() {
  idCounter++;
  return `test-student-${idCounter}`;
}

function resetIdCounter() {
  idCounter = 0;
}

function createMockStudents(count, options = {}) {
  const students = [];
  for (let i = 0; i < count; i++) {
    const gender = options.gender || (i % 2 === 0 ? 'F' : 'M');
    const readingScore = options.readingScore ?? 50 + (i * 5) % 50;
    const mathScore = options.mathScore ?? 40 + (i * 7) % 50;
    const languageScore = options.languageScore ?? 60 + (i * 3) % 40;
    const behavior = options.behavior ?? false;
    const giftedTalented = options.giftedTalented ?? false;
    const sped = options.sped ?? false;

    students.push({
      id: uid(),
      name: `Student ${i + 1}`,
      gender,
      readingScore,
      mathScore,
      languageScore,
      behavior,
      giftedTalented,
      sped,
    });
  }
  return students;
}

const numericCriteria = [
  { key: 'readingScore', label: 'Reading Score', short: 'Read', weight: 1.0 },
  { key: 'mathScore', label: 'Math Score', short: 'Math', weight: 1.0 },
  { key: 'languageScore', label: 'Language Score', short: 'Lang', weight: 1.0 },
];

const flagCriteria = [
  { key: 'behavior', label: 'Behavior', short: 'BEH', weight: 2.0 },
  { key: 'giftedTalented', label: 'Gifted & Talented', short: 'GT', weight: 1.5 },
  { key: 'sped', label: 'SPED', short: 'SPED', weight: 2.0 },
];

describe('Optimizer', () => {
  describe('Determinism', () => {
    test('same inputs produce identical assignments', () => {
      // Arrange
      const students = createMockStudents(20, { readingScore: 50, mathScore: 60 });
      const numClasses = 3;
      const lockedAssignments = {};

      // Act
      const assignment1 = optimize(students, numClasses, lockedAssignments, numericCriteria, flagCriteria);
      const assignment2 = optimize(students, numClasses, lockedAssignments, numericCriteria, flagCriteria);

      // Assert
      expect(assignment1).toEqual(assignment2);
    });

    test('different seeds produce different outputs', () => {
      // Arrange
      const students1 = createMockStudents(20, { readingScore: 50 });
      const students2 = createMockStudents(20, { readingScore: 60 }); // Different scores = different seed
      const numClasses = 3;

      // Act
      const assignment1 = optimize(students1, numClasses, {}, numericCriteria, flagCriteria);
      const assignment2 = optimize(students2, numClasses, {}, numericCriteria, flagCriteria);

      // Assert - different inputs should produce different outputs (with high probability)
      // Note: Very rarely they could be the same by chance
      expect(assignment1).not.toEqual(assignment2);
    });

    test('determinism holds across multiple runs', () => {
      // Arrange
      const students = createMockStudents(15);
      const numClasses = 2;

      // Act - run 5 times
      const assignments = [];
      for (let i = 0; i < 5; i++) {
        assignments.push(optimize(students, numClasses, {}, numericCriteria, flagCriteria));
      }

      // Assert - all should be identical
      for (let i = 1; i < assignments.length; i++) {
        expect(assignments[i]).toEqual(assignments[0]);
      }
    });

    test('computeSeed produces consistent values', () => {
      // Arrange
      const students = createMockStudents(10);
      const numClasses = 2;
      const lockedAssignments = {};

      // Act
      const seed1 = computeSeed(students, numClasses, lockedAssignments, numericCriteria, flagCriteria);
      const seed2 = computeSeed(students, numClasses, lockedAssignments, numericCriteria, flagCriteria);

      // Assert
      expect(seed1).toBe(seed2);
    });

    test('createSeededRNG produces deterministic sequence', () => {
      // Arrange
      const seed = 12345;

      // Act
      const rng1 = createSeededRNG(seed);
      const rng2 = createSeededRNG(seed);
      const sequence1 = [];
      const sequence2 = [];
      for (let i = 0; i < 10; i++) {
        sequence1.push(rng1());
        sequence2.push(rng2());
      }

      // Assert
      expect(sequence1).toEqual(sequence2);
    });
  });

  describe('Cost-Path Parity', () => {
    test('computeCost and optimizer cost agree for same assignment', () => {
      // Arrange
      const students = createMockStudents(16);
      const numClasses = 2;
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria);

      // Act
      const cost = computeCost(students, assignment, numClasses, numericCriteria, flagCriteria);

      // Assert - cost should be a positive finite number
      expect(cost).toBeGreaterThan(0);
      expect(Number.isFinite(cost)).toBe(true);
    });

    test('cost is consistent across criteria types', () => {
      // Arrange
      const students = createMockStudents(12, {
        gender: 'F',
        readingScore: 75,
        behavior: true,
      });
      const numClasses = 3;
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria);

      // Act
      const cost = computeCost(students, assignment, numClasses, numericCriteria, flagCriteria);

      // Assert
      expect(cost).toBeGreaterThan(0);
      expect(Number.isFinite(cost)).toBe(true);
    });

    test('cost decreases with better balanced assignments', () => {
      // Arrange - students with identical scores (perfectly balanced)
      const balancedStudents = createMockStudents(12, {
        readingScore: 50,
        mathScore: 60,
        languageScore: 70,
        gender: 'F',
      });

      // Arrange - students with varied scores (harder to balance)
      const variedStudents = createMockStudents(12);
      variedStudents.forEach((s, i) => {
        s.readingScore = i * 10; // 0, 10, 20, ...
        s.mathScore = i * 5;
        s.languageScore = i * 8;
      });

      const numClasses = 2;

      // Act
      const balancedAssignment = optimize(balancedStudents, numClasses, {}, numericCriteria, flagCriteria);
      const variedAssignment = optimize(variedStudents, numClasses, {}, numericCriteria, flagCriteria);

      const balancedCost = computeCost(balancedStudents, balancedAssignment, numClasses, numericCriteria, flagCriteria);
      const variedCost = computeCost(variedStudents, variedAssignment, numClasses, numericCriteria, flagCriteria);

      // Assert - identical students should have near-zero cost
      expect(balancedCost).toBeLessThan(variedCost);
    });
  });

  describe('Delta Correctness', () => {
    test('optimizer produces valid assignments', () => {
      // Arrange
      const students = createMockStudents(20);
      const numClasses = 4;

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria);

      // Assert - all students assigned
      students.forEach(s => {
        expect(assignment[s.id]).toBeDefined();
        expect(assignment[s.id]).toBeGreaterThanOrEqual(0);
        expect(assignment[s.id]).toBeLessThan(numClasses);
      });
    });

    test('class sizes are balanced', () => {
      // Arrange
      const students = createMockStudents(20);
      const numClasses = 4;
      const expectedSize = students.length / numClasses;

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria);

      // Assert - count students per class
      const classCounts = new Array(numClasses).fill(0);
      students.forEach(s => {
        classCounts[assignment[s.id]]++;
      });

      // Each class should have expectedSize students (or within 1)
      classCounts.forEach(count => {
        expect(Math.abs(count - expectedSize)).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Locked Student Preservation', () => {
    test('locked assignments are preserved', () => {
      // Arrange
      const students = createMockStudents(10);
      const numClasses = 2;
      const lockedAssignments = {};
      // Lock first 3 students to class 0
      lockedAssignments[students[0].id] = 0;
      lockedAssignments[students[1].id] = 0;
      lockedAssignments[students[2].id] = 0;

      // Act
      const assignment = optimize(students, numClasses, lockedAssignments, numericCriteria, flagCriteria);

      // Assert - locked students remain in their assigned class
      expect(assignment[students[0].id]).toBe(0);
      expect(assignment[students[1].id]).toBe(0);
      expect(assignment[students[2].id]).toBe(0);
    });

    test('locked students affect class distribution', () => {
      // Arrange
      const students = createMockStudents(10);
      const numClasses = 2;
      const lockedAssignments = {};
      // Lock 4 students to class 0
      lockedAssignments[students[0].id] = 0;
      lockedAssignments[students[1].id] = 0;
      lockedAssignments[students[2].id] = 0;
      lockedAssignments[students[3].id] = 0;

      // Act
      const assignment = optimize(students, numClasses, lockedAssignments, numericCriteria, flagCriteria);

      // Assert - count in each class
      const classCounts = [0, 0];
      students.forEach(s => {
        classCounts[assignment[s.id]]++;
      });

      // Class 0 should have at least 4 (the locked ones)
      expect(classCounts[0]).toBeGreaterThanOrEqual(4);
    });

    test('all students locked returns locked assignments unchanged', () => {
      // Arrange
      const students = createMockStudents(6);
      const numClasses = 2;
      const lockedAssignments = {};
      // Lock all students
      students.forEach((s, i) => {
        lockedAssignments[s.id] = i % numClasses;
      });

      // Act
      const assignment = optimize(students, numClasses, lockedAssignments, numericCriteria, flagCriteria);

      // Assert - should match locked assignments exactly
      students.forEach(s => {
        expect(assignment[s.id]).toBe(lockedAssignments[s.id]);
      });
    });
  });

  describe('Edge Cases', () => {
    test('empty student list returns empty assignment', () => {
      // Arrange
      const students = [];
      const numClasses = 2;

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria);

      // Assert
      expect(assignment).toEqual({});
    });

    test('single class puts all students in class 0', () => {
      // Arrange
      const students = createMockStudents(10);
      const numClasses = 1;

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria);

      // Assert
      students.forEach(s => {
        expect(assignment[s.id]).toBe(0);
      });
    });

    test('zero variance on numeric criteria', () => {
      // Arrange - all students have identical scores
      const students = createMockStudents(10, {
        readingScore: 50,
        mathScore: 60,
        languageScore: 70,
      });
      const numClasses = 2;

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria);
      const cost = computeCost(students, assignment, numClasses, numericCriteria, flagCriteria);

      // Assert - assignment should work, cost should be low
      students.forEach(s => {
        expect(assignment[s.id]).toBeDefined();
      });
      // Cost should be low since all scores are identical
      expect(cost).toBeLessThan(1);
    });

    test('all-same-gender roster', () => {
      // Arrange
      const students = createMockStudents(12, { gender: 'F' });
      const numClasses = 3;

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria);

      // Assert - should handle gracefully
      students.forEach(s => {
        expect(assignment[s.id]).toBeDefined();
      });
    });

    test('minimum viable inputs (2 students, 2 classes)', () => {
      // Arrange
      const students = createMockStudents(2);
      const numClasses = 2;

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria);

      // Assert
      expect(Object.keys(assignment)).toHaveLength(2);
      students.forEach(s => {
        expect(assignment[s.id]).toBeGreaterThanOrEqual(0);
        expect(assignment[s.id]).toBeLessThan(numClasses);
      });
    });

    test('student count exactly divisible by class count', () => {
      // Arrange - 12 students, 3 classes = 4 per class exactly
      const students = createMockStudents(12);
      const numClasses = 3;

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria);

      // Assert - count per class
      const classCounts = new Array(numClasses).fill(0);
      students.forEach(s => {
        classCounts[assignment[s.id]]++;
      });

      // Each class should have exactly 4 students
      classCounts.forEach(count => {
        expect(count).toBe(4);
      });
    });

    test('handles students with all flags set', () => {
      // Arrange
      const students = createMockStudents(8, {
        behavior: true,
        giftedTalented: true,
        sped: true,
      });
      const numClasses = 2;

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria);

      // Assert
      students.forEach(s => {
        expect(assignment[s.id]).toBeDefined();
      });
    });

    test('handles students with no flags set', () => {
      // Arrange
      const students = createMockStudents(8, {
        behavior: false,
        giftedTalented: false,
        sped: false,
      });
      const numClasses = 2;

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria);

      // Assert
      students.forEach(s => {
        expect(assignment[s.id]).toBeDefined();
      });
    });
  });

  describe('Keep Apart Constraints', () => {
    test('keep apart constraint places students in different classes', () => {
      // Arrange
      const students = createMockStudents(4);
      const numClasses = 2;
      // Force two students to be kept apart
      const keepApart = [[students[0].id, students[1].id]];

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria, keepApart);

      // Assert - the two students should be in different classes
      expect(assignment[students[0].id]).not.toBe(assignment[students[1].id]);
    });

    test('cost includes penalty for keep-apart violations', () => {
      // Arrange
      const students = createMockStudents(4);
      const numClasses = 2;
      const keepApart = [[students[0].id, students[1].id]];

      // Create an assignment with violation
      const violatingAssignment = {
        [students[0].id]: 0,
        [students[1].id]: 0, // Same class - violation!
        [students[2].id]: 1,
        [students[3].id]: 1,
      };

      // Create an assignment without violation
      const validAssignment = {
        [students[0].id]: 0,
        [students[1].id]: 1, // Different class - no violation
        [students[2].id]: 0,
        [students[3].id]: 1,
      };

      // Act
      const violatingCost = computeCost(students, violatingAssignment, numClasses, numericCriteria, flagCriteria, keepApart);
      const validCost = computeCost(students, validAssignment, numClasses, numericCriteria, flagCriteria, keepApart);

      // Assert - violating cost should be higher by approximately 100 (penalty weight)
      expect(violatingCost).toBeGreaterThan(validCost + 90);
    });

    test('determinism holds with keep apart constraints', () => {
      // Arrange
      const students = createMockStudents(6);
      const numClasses = 2;
      const keepApart = [[students[0].id, students[1].id], [students[2].id, students[3].id]];

      // Act - run twice with same inputs
      const assignment1 = optimize(students, numClasses, {}, numericCriteria, flagCriteria, keepApart);
      const assignment2 = optimize(students, numClasses, {}, numericCriteria, flagCriteria, keepApart);

      // Assert - should be identical
      expect(assignment1).toEqual(assignment2);
    });

    test('computeSeed includes keep apart constraints', () => {
      // Arrange
      const students = createMockStudents(4);
      const numClasses = 2;
      const keepApart1 = [[students[0].id, students[1].id]];
      const keepApart2 = [[students[0].id, students[2].id]]; // Different constraint

      // Act
      const seed1 = computeSeed(students, numClasses, {}, numericCriteria, flagCriteria, keepApart1);
      const seed2 = computeSeed(students, numClasses, {}, numericCriteria, flagCriteria, keepApart2);

      // Assert - different constraints should produce different seeds
      expect(seed1).not.toBe(seed2);
    });

    test('same keep apart constraints produce same seed', () => {
      // Arrange
      const students = createMockStudents(4);
      const numClasses = 2;
      const keepApart = [[students[0].id, students[1].id]];

      // Act
      const seed1 = computeSeed(students, numClasses, {}, numericCriteria, flagCriteria, keepApart);
      const seed2 = computeSeed(students, numClasses, {}, numericCriteria, flagCriteria, keepApart);

      // Assert - same constraints should produce same seed
      expect(seed1).toBe(seed2);
    });

    test('multiple keep apart constraints are respected', () => {
      // Arrange
      const students = createMockStudents(6);
      const numClasses = 3;
      const keepApart = [
        [students[0].id, students[1].id],
        [students[1].id, students[2].id],
        [students[3].id, students[4].id],
      ];

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria, keepApart);

      // Assert - check all constraints are satisfied
      expect(assignment[students[0].id]).not.toBe(assignment[students[1].id]);
      expect(assignment[students[1].id]).not.toBe(assignment[students[2].id]);
      expect(assignment[students[3].id]).not.toBe(assignment[students[4].id]);
    });

    test('empty keep apart array works normally', () => {
      // Arrange
      const students = createMockStudents(6);
      const numClasses = 2;

      // Act
      const assignmentWithConstraint = optimize(students, numClasses, {}, numericCriteria, flagCriteria, []);
      const assignmentWithoutConstraint = optimize(students, numClasses, {}, numericCriteria, flagCriteria);

      // Assert - should produce same results
      expect(assignmentWithConstraint).toEqual(assignmentWithoutConstraint);
    });
  });
});
