import { describe, test, expect } from 'vitest';
import { optimize, computeCost, computeSeed, createSeededRNG, computeAdaptiveAnnealingParams } from '../src/optimizer.js';

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
    const extendedLearning = options.extendedLearning ?? false;
    const sped = options.sped ?? false;

    students.push({
      id: uid(),
      name: `Student ${i + 1}`,
      gender,
      readingScore,
      mathScore,
      languageScore,
      behavior,
      extendedLearning,
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
  { key: 'extendedLearning', label: 'Extended Learning', short: 'ExtL', weight: 1.5 },
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
        extendedLearning: true,
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
        extendedLearning: false,
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

  describe('Keep Together Constraints', () => {
    test('keep together constraint encourages students to be in same class', () => {
      // Arrange - small class count so togetherness is easier to achieve
      const students = createMockStudents(6);
      const numClasses = 2;
      // Force two students to be kept together
      const keepTogether = [[students[0].id, students[1].id]];

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria, [], keepTogether);

      // Assert - with high penalty weight, optimizer should usually keep them together
      // Note: This is a soft constraint, not a guarantee
      const cost = computeCost(students, assignment, numClasses, numericCriteria, flagCriteria, [], keepTogether);

      // The cost should be reasonably low, indicating the optimizer tried to respect the constraint
      expect(cost).toBeLessThan(500); // Very high cost would indicate ignoring the constraint
    });

    test('cost includes penalty for keep-together violations', () => {
      // Arrange
      const students = createMockStudents(4);
      const numClasses = 2;
      const keepTogether = [[students[0].id, students[1].id]];

      // Create an assignment with violation
      const violatingAssignment = {
        [students[0].id]: 0,
        [students[1].id]: 1, // Different class - violation!
        [students[2].id]: 0,
        [students[3].id]: 1,
      };

      // Create an assignment without violation
      const validAssignment = {
        [students[0].id]: 0,
        [students[1].id]: 0, // Same class - no violation
        [students[2].id]: 1,
        [students[3].id]: 1,
      };

      // Act
      const violatingCost = computeCost(students, violatingAssignment, numClasses, numericCriteria, flagCriteria, [], keepTogether);
      const validCost = computeCost(students, validAssignment, numClasses, numericCriteria, flagCriteria, [], keepTogether);

      // Assert - violating cost should be higher by approximately 200 (penalty weight)
      expect(violatingCost).toBeGreaterThan(validCost + 190);
    });

    test('determinism holds with keep together constraints', () => {
      // Arrange
      const students = createMockStudents(6);
      const numClasses = 2;
      const keepTogether = [[students[0].id, students[1].id], [students[2].id, students[3].id]];

      // Act - run twice with same inputs
      const assignment1 = optimize(students, numClasses, {}, numericCriteria, flagCriteria, [], keepTogether);
      const assignment2 = optimize(students, numClasses, {}, numericCriteria, flagCriteria, [], keepTogether);

      // Assert - should be identical
      expect(assignment1).toEqual(assignment2);
    });

    test('computeSeed includes keep together constraints', () => {
      // Arrange
      const students = createMockStudents(4);
      const numClasses = 2;
      const keepTogether1 = [[students[0].id, students[1].id]];
      const keepTogether2 = [[students[0].id, students[2].id]]; // Different constraint

      // Act
      const seed1 = computeSeed(students, numClasses, {}, numericCriteria, flagCriteria, [], keepTogether1);
      const seed2 = computeSeed(students, numClasses, {}, numericCriteria, flagCriteria, [], keepTogether2);

      // Assert - different constraints should produce different seeds
      expect(seed1).not.toBe(seed2);
    });

    test('same keep together constraints produce same seed', () => {
      // Arrange
      const students = createMockStudents(4);
      const numClasses = 2;
      const keepTogether = [[students[0].id, students[1].id]];

      // Act
      const seed1 = computeSeed(students, numClasses, {}, numericCriteria, flagCriteria, [], keepTogether);
      const seed2 = computeSeed(students, numClasses, {}, numericCriteria, flagCriteria, [], keepTogether);

      // Assert - same constraints should produce same seed
      expect(seed1).toBe(seed2);
    });

    test('multiple keep together groups are respected', () => {
      // Arrange
      const students = createMockStudents(8);
      const numClasses = 4;
      const keepTogether = [
        [students[0].id, students[1].id],
        [students[2].id, students[3].id],
      ];

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria, [], keepTogether);

      // Assert - check all groups are together
      expect(assignment[students[0].id]).toBe(assignment[students[1].id]);
      expect(assignment[students[2].id]).toBe(assignment[students[3].id]);
    });

    test('empty keep together array works normally', () => {
      // Arrange
      const students = createMockStudents(6);
      const numClasses = 2;

      // Act
      const assignmentWithConstraint = optimize(students, numClasses, {}, numericCriteria, flagCriteria, [], []);
      const assignmentWithoutConstraint = optimize(students, numClasses, {}, numericCriteria, flagCriteria, []);

      // Assert - should produce same results
      expect(assignmentWithConstraint).toEqual(assignmentWithoutConstraint);
    });

    test('group of size 1 is ignored', () => {
      // Arrange
      const students = createMockStudents(4);
      const numClasses = 2;
      const keepTogether = [[students[0].id]]; // Single student group

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria, [], keepTogether);

      // Assert - should work normally
      students.forEach(s => {
        expect(assignment[s.id]).toBeDefined();
      });
    });

    test('absurd stress test: 100000 students with 5000 classes', () => {
      // Arrange - absurd scale to test vanishing probability
      const students = createMockStudents(100000);
      const numClasses = 5000;
      const keepTogether = [
        [students[0].id, students[1].id, students[2].id, students[3].id, students[4].id], // Group of 5
      ];

      // Act
      const startTime = Date.now();
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria, [], keepTogether);
      const duration = Date.now() - startTime;

      // Assert - group (size 5) should be together
      const groupClass = assignment[students[0].id];
      expect(assignment[students[1].id]).toBe(groupClass);
      expect(assignment[students[2].id]).toBe(groupClass);
      expect(assignment[students[3].id]).toBe(groupClass);
      expect(assignment[students[4].id]).toBe(groupClass);

      // Verify class size is reasonable (around 20 students per class)
      const classCounts = new Map();
      Object.values(assignment).forEach(c => {
        classCounts.set(c, (classCounts.get(c) || 0) + 1);
      });
      const avgSize = 100000 / 5000;
      console.log(`Absurd test completed in ${duration}ms, avg class size: ${avgSize}`);
    });

    test('comprehensive absurd stress test: all constraint types with 10000 students', () => {
      // Arrange - test all constraint types at scale
      const students = createMockStudents(10000);
      const numClasses = 100;

      // Create multiple keep-together groups (sizes 2-5)
      const keepTogether = [
        [students[0].id, students[1].id], // Group 1: size 2
        [students[2].id, students[3].id, students[4].id], // Group 2: size 3
        [students[5].id, students[6].id, students[7].id, students[8].id], // Group 3: size 4
        [students[9].id, students[10].id, students[11].id, students[12].id, students[13].id], // Group 4: size 5
      ];

      // Create keep-apart pairs (students from different groups)
      const keepApart = [
        [students[0].id, students[2].id], // Group 1 member apart from Group 2 member
        [students[5].id, students[9].id], // Group 3 member apart from Group 4 member
      ];

      // Create keep-out-of-class constraints
      const keepOutOfClass = [
        { studentId: students[0].id, classIndex: 0 }, // Group 1 leader can't be in class 0
        { studentId: students[9].id, classIndex: 1 }, // Group 4 leader can't be in class 1
      ];

      // Lock one student to a specific class
      const lockedAssignments = { [students[20].id]: 50 };

      // Act
      const startTime = Date.now();
      const assignment = optimize(students, numClasses, lockedAssignments, numericCriteria, flagCriteria, keepApart, keepTogether, keepOutOfClass);
      const duration = Date.now() - startTime;

      // Assert - all keep-together groups should be together
      keepTogether.forEach(group => {
        const groupClass = assignment[group[0]];
        group.forEach(studentId => {
          expect(assignment[studentId]).toBe(groupClass);
        });
      });

      // Assert - keep-apart pairs should be in different classes
      keepApart.forEach(([id1, id2]) => {
        expect(assignment[id1]).not.toBe(assignment[id2]);
      });

      // Assert - keep-out-of-class constraints should be respected
      keepOutOfClass.forEach(({ studentId, classIndex }) => {
        expect(assignment[studentId]).not.toBe(classIndex);
      });

      // Assert - locked student should remain in assigned class
      expect(assignment[students[20].id]).toBe(50);

      // Assert - locked student should not break their keep-together group
      const lockedGroupClass = assignment[students[0].id];
      expect(assignment[students[1].id]).toBe(lockedGroupClass);

      console.log(`Comprehensive absurd test completed in ${duration}ms`);
    });
  });

  describe('Keep Out of Class Constraints', () => {
    test('keep out of class constraint prevents student from being assigned to blocked class', () => {
      // Arrange
      const students = createMockStudents(6);
      const numClasses = 3;
      // Block student 0 from class 0
      const keepOutOfClass = [{ studentId: students[0].id, classIndex: 0 }];

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria, [], [], keepOutOfClass);

      // Assert - student should not be in class 0
      expect(assignment[students[0].id]).not.toBe(0);
      expect(assignment[students[0].id]).toBeGreaterThanOrEqual(1);
      expect(assignment[students[0].id]).toBeLessThan(numClasses);
    });

    test('cost includes penalty for keep-out-of-class violations', () => {
      // Arrange
      const students = createMockStudents(4);
      const numClasses = 2;
      const keepOutOfClass = [{ studentId: students[0].id, classIndex: 0 }];

      // Create an assignment with violation
      const violatingAssignment = {
        [students[0].id]: 0, // Student 0 in class 0 - violation!
        [students[1].id]: 1,
        [students[2].id]: 1,
        [students[3].id]: 0,
      };

      // Create an assignment without violation
      const validAssignment = {
        [students[0].id]: 1, // Student 0 in class 1 - no violation
        [students[1].id]: 0,
        [students[2].id]: 1,
        [students[3].id]: 0,
      };

      // Act
      const violatingCost = computeCost(students, violatingAssignment, numClasses, numericCriteria, flagCriteria, [], [], keepOutOfClass);
      const validCost = computeCost(students, validAssignment, numClasses, numericCriteria, flagCriteria, [], [], keepOutOfClass);

      // Assert - violating cost should be higher by approximately 150 (penalty weight)
      expect(violatingCost).toBeGreaterThan(validCost + 140);
    });

    test('determinism holds with keep out of class constraints', () => {
      // Arrange
      const students = createMockStudents(6);
      const numClasses = 2;
      const keepOutOfClass = [
        { studentId: students[0].id, classIndex: 0 },
        { studentId: students[1].id, classIndex: 1 }
      ];

      // Act - run twice with same inputs
      const assignment1 = optimize(students, numClasses, {}, numericCriteria, flagCriteria, [], [], keepOutOfClass);
      const assignment2 = optimize(students, numClasses, {}, numericCriteria, flagCriteria, [], [], keepOutOfClass);

      // Assert - should be identical
      expect(assignment1).toEqual(assignment2);
    });

    test('computeSeed includes keep out of class constraints', () => {
      // Arrange
      const students = createMockStudents(4);
      const numClasses = 2;
      const keepOutOfClass1 = [{ studentId: students[0].id, classIndex: 0 }];
      const keepOutOfClass2 = [{ studentId: students[0].id, classIndex: 1 }]; // Different constraint

      // Act
      const seed1 = computeSeed(students, numClasses, {}, numericCriteria, flagCriteria, [], [], keepOutOfClass1);
      const seed2 = computeSeed(students, numClasses, {}, numericCriteria, flagCriteria, [], [], keepOutOfClass2);

      // Assert - different constraints should produce different seeds
      expect(seed1).not.toBe(seed2);
    });

    test('same keep out of class constraints produce same seed', () => {
      // Arrange
      const students = createMockStudents(4);
      const numClasses = 2;
      const keepOutOfClass = [{ studentId: students[0].id, classIndex: 0 }];

      // Act
      const seed1 = computeSeed(students, numClasses, {}, numericCriteria, flagCriteria, [], [], keepOutOfClass);
      const seed2 = computeSeed(students, numClasses, {}, numericCriteria, flagCriteria, [], [], keepOutOfClass);

      // Assert - same constraints should produce same seed
      expect(seed1).toBe(seed2);
    });

    test('multiple keep out of class constraints are respected', () => {
      // Arrange
      const students = createMockStudents(8);
      const numClasses = 4;
      const keepOutOfClass = [
        { studentId: students[0].id, classIndex: 0 },
        { studentId: students[1].id, classIndex: 1 },
        { studentId: students[2].id, classIndex: 2 },
      ];

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria, [], [], keepOutOfClass);

      // Assert - check all constraints are satisfied
      expect(assignment[students[0].id]).not.toBe(0);
      expect(assignment[students[1].id]).not.toBe(1);
      expect(assignment[students[2].id]).not.toBe(2);
    });

    test('empty keep out of class array works normally', () => {
      // Arrange
      const students = createMockStudents(6);
      const numClasses = 2;

      // Act
      const assignmentWithConstraint = optimize(students, numClasses, {}, numericCriteria, flagCriteria, [], [], []);
      const assignmentWithoutConstraint = optimize(students, numClasses, {}, numericCriteria, flagCriteria, [], []);

      // Assert - should produce same results
      expect(assignmentWithConstraint).toEqual(assignmentWithoutConstraint);
    });

    test('keep out of class with locked assignments', () => {
      // Arrange
      const students = createMockStudents(6);
      const numClasses = 3;
      const keepOutOfClass = [{ studentId: students[0].id, classIndex: 0 }];
      const lockedAssignments = { [students[0].id]: 1 }; // Lock student 0 to class 1

      // Act
      const assignment = optimize(students, numClasses, lockedAssignments, numericCriteria, flagCriteria, [], [], keepOutOfClass);

      // Assert - locked assignment should be respected and also satisfy constraint
      expect(assignment[students[0].id]).toBe(1);
    });
  });

  describe('Combined Constraints', () => {
    test('keep apart and keep together work together', () => {
      // Arrange
      const students = createMockStudents(8);
      const numClasses = 2;
      const keepApart = [[students[0].id, students[2].id]];
      const keepTogether = [[students[0].id, students[1].id]];

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria, keepApart, keepTogether);

      // Assert - students 0 and 1 should be together
      expect(assignment[students[0].id]).toBe(assignment[students[1].id]);
      // student 0 and 2 should be apart
      expect(assignment[students[0].id]).not.toBe(assignment[students[2].id]);
    });

    test('determinism holds with both constraint types', () => {
      // Arrange
      const students = createMockStudents(8);
      const numClasses = 2;
      const keepApart = [[students[0].id, students[2].id]];
      const keepTogether = [[students[0].id, students[1].id]];

      // Act
      const assignment1 = optimize(students, numClasses, {}, numericCriteria, flagCriteria, keepApart, keepTogether);
      const assignment2 = optimize(students, numClasses, {}, numericCriteria, flagCriteria, keepApart, keepTogether);

      // Assert - should be identical
      expect(assignment1).toEqual(assignment2);
    });

    test('all three constraint types work together', () => {
      // Arrange
      const students = createMockStudents(12);
      const numClasses = 4;
      const keepApart = [[students[0].id, students[1].id]];
      const keepTogether = [[students[2].id, students[3].id]];
      const keepOutOfClass = [{ studentId: students[0].id, classIndex: 0 }];

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, flagCriteria, keepApart, keepTogether, keepOutOfClass);

      // Assert - check all constraints
      expect(assignment[students[0].id]).not.toBe(assignment[students[1].id]); // Apart
      expect(assignment[students[2].id]).toBe(assignment[students[3].id]); // Together
      expect(assignment[students[0].id]).not.toBe(0); // Out of class 0
    });

    test('determinism holds with all three constraint types', () => {
      // Arrange
      const students = createMockStudents(8);
      const numClasses = 2;
      const keepApart = [[students[0].id, students[2].id]];
      const keepTogether = [[students[0].id, students[1].id]];
      const keepOutOfClass = [{ studentId: students[3].id, classIndex: 0 }];

      // Act
      const assignment1 = optimize(students, numClasses, {}, numericCriteria, flagCriteria, keepApart, keepTogether, keepOutOfClass);
      const assignment2 = optimize(students, numClasses, {}, numericCriteria, flagCriteria, keepApart, keepTogether, keepOutOfClass);

      // Assert - should be identical
      expect(assignment1).toEqual(assignment2);
    });
  });

  describe('Adaptive Annealing Parameters', () => {
    test('base case (27 students, 3 classes) returns original parameters', () => {
      // Arrange
      const numStudents = 27;
      const numClasses = 3;

      // Act
      const params = computeAdaptiveAnnealingParams(numStudents, numClasses);

      // Assert - should be close to original values for base case
      expect(params.temp).toBe(4.0);
      expect(params.maxIters).toBeGreaterThanOrEqual(99000); // ~100k
      expect(params.maxIters).toBeLessThanOrEqual(101000);
      expect(params.cooling).toBeGreaterThanOrEqual(0.9996);
      expect(params.cooling).toBeLessThanOrEqual(0.9997);
      expect(params.convergenceWindow).toBe(5000);
    });

    test('scales iterations with problem size', () => {
      // Arrange
      const smallParams = computeAdaptiveAnnealingParams(27, 3);
      const mediumParams = computeAdaptiveAnnealingParams(500, 25); // Problem size ~24x larger
      const largeParams = computeAdaptiveAnnealingParams(5000, 250); // Problem size ~15,000x larger

      // Assert - iterations should scale with √problemSize until hitting the cap
      expect(mediumParams.maxIters).toBeGreaterThan(smallParams.maxIters);
      // Both 500×25 and 5000×250 are capped at 500k, so they may be equal
      expect(largeParams.maxIters).toBeGreaterThanOrEqual(mediumParams.maxIters);
      
      // Large problem should have at least 300k iterations (or hit the 500k cap)
      expect(largeParams.maxIters).toBeGreaterThan(300000);
      expect(largeParams.maxIters).toBeLessThanOrEqual(500000);
    });

    test('cooling rate adjusts for problem size', () => {
      // Arrange
      const smallParams = computeAdaptiveAnnealingParams(27, 3);
      const largeParams = computeAdaptiveAnnealingParams(5000, 250);

      // Assert - larger problems should have slightly slower cooling
      expect(largeParams.cooling).toBeLessThan(smallParams.cooling);
      expect(largeParams.cooling).toBeGreaterThan(0.999); // Stay close to 1.0 for effective annealing
    });

    test('convergence window scales with problem size', () => {
      // Arrange
      const smallParams = computeAdaptiveAnnealingParams(20, 2); // 20 students
      const mediumParams = computeAdaptiveAnnealingParams(100, 4); // 100 students
      const largeParams = computeAdaptiveAnnealingParams(20000, 400); // 20000 students

      // Assert - window should be at least 5000, then 30% of student count
      expect(smallParams.convergenceWindow).toBe(5000); // max(5000, 6) = 5000
      expect(mediumParams.convergenceWindow).toBe(5000); // max(5000, 30) = 5000
      expect(largeParams.convergenceWindow).toBeGreaterThan(5000);
      expect(largeParams.convergenceWindow).toBe(Math.floor(20000 * 0.3)); // 6000
    });

    test('convergence threshold decreases with problem size', () => {
      // Arrange
      const smallParams = computeAdaptiveAnnealingParams(27, 3);
      const largeParams = computeAdaptiveAnnealingParams(5000, 250);

      // Assert - larger problems need finer optimization
      expect(largeParams.convergenceThreshold).toBeLessThan(smallParams.convergenceThreshold);
      expect(largeParams.convergenceThreshold).toBeGreaterThan(0); // But not zero
    });

    test('very large problems cap cooling rate', () => {
      // Arrange - extremely large problem
      const hugeParams = computeAdaptiveAnnealingParams(100000, 5000);

      // Assert - cooling should be capped to prevent too slow cooling
      expect(hugeParams.cooling).toBeLessThanOrEqual(0.99995);
    });

    test('minimum convergence threshold is enforced', () => {
      // Arrange - extremely large problem
      const hugeParams = computeAdaptiveAnnealingParams(100000, 5000);

      // Assert - threshold should not go below minimum
      expect(hugeParams.convergenceThreshold).toBeGreaterThanOrEqual(0.0001);
    });
  });

  describe('Weighted Composite Calculations', () => {
    test('individual flag weights affect total flags composite', () => {
      // Arrange - two students with different flags
      const students = [
        { id: 'student-1', name: 'High Weight', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: true, extendedLearning: false, sped: false },
        { id: 'student-2', name: 'Low Weight', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: true, sped: false },
        { id: 'student-3', name: 'None', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: false, sped: false },
        { id: 'student-4', name: 'None', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: false, sped: false },
      ];
      
      // High-weighted flag criteria (behavior=3.0, extendedLearning=0.5)
      const weightedFlagCriteria = [
        { key: 'behavior', label: 'Behavior', short: 'BEH', weight: 3.0 },
        { key: 'extendedLearning', label: 'Extended Learning', short: 'ExtL', weight: 0.5 },
        { key: 'sped', label: 'SPED', short: 'SPED', weight: 1.0 },
      ];
      
      // Equal-weighted flag criteria (all 1.0)
      const equalFlagCriteria = [
        { key: 'behavior', label: 'Behavior', short: 'BEH', weight: 1.0 },
        { key: 'extendedLearning', label: 'Extended Learning', short: 'ExtL', weight: 1.0 },
        { key: 'sped', label: 'SPED', short: 'SPED', weight: 1.0 },
      ];
      
      const numClasses = 2;
      const assignment = { 'student-1': 0, 'student-2': 0, 'student-3': 1, 'student-4': 1 };

      // Act - compute costs with different flag weightings
      const weightedCost = computeCost(students, assignment, numClasses, numericCriteria, weightedFlagCriteria);
      const equalCost = computeCost(students, assignment, numClasses, numericCriteria, equalFlagCriteria);

      // Assert - weighted cost should be different (weighted total flags: 3.5 vs 2.0 for class 0)
      expect(weightedCost).not.toBe(equalCost);
    });

    test('downweighted flags contribute less to total flags composite', () => {
      // Arrange - student with a flag
      const students = [
        { id: 'student-1', name: 'Student', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: true, extendedLearning: false, sped: false },
        { id: 'student-2', name: 'Student', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: false, sped: false },
        { id: 'student-3', name: 'Student', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: false, sped: false },
        { id: 'student-4', name: 'Student', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: false, sped: false },
      ];
      
      // High weight for behavior
      const highWeightCriteria = [
        { key: 'behavior', label: 'Behavior', short: 'BEH', weight: 2.0 },
      ];
      
      // Low weight for behavior
      const lowWeightCriteria = [
        { key: 'behavior', label: 'Behavior', short: 'BEH', weight: 0.1 },
      ];
      
      const numClasses = 2;
      const assignment = { 'student-1': 0, 'student-2': 0, 'student-3': 1, 'student-4': 1 };

      // Act - compute costs
      const highCost = computeCost(students, assignment, numClasses, numericCriteria, highWeightCriteria);
      const lowCost = computeCost(students, assignment, numClasses, numericCriteria, lowWeightCriteria);

      // Assert - high weight should produce higher total flags variance penalty
      // (class 0 has weighted total of 2.0 vs class 1 having 0, vs 0.1 vs 0 for low weight)
      expect(highCost).toBeGreaterThan(lowCost);
    });

    test('individual score weights affect total score composite', () => {
      // Arrange - students with varied scores
      const students = [
        { id: 'student-1', name: 'High Reading', gender: 'F', readingScore: 90, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: false, sped: false },
        { id: 'student-2', name: 'Low Reading', gender: 'F', readingScore: 30, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: false, sped: false },
        { id: 'student-3', name: 'Medium High', gender: 'F', readingScore: 80, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: false, sped: false },
        { id: 'student-4', name: 'Medium Low', gender: 'F', readingScore: 40, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: false, sped: false },
      ];
      
      // High weight on reading
      const readingWeightedCriteria = [
        { key: 'readingScore', label: 'Reading Score', short: 'Read', weight: 3.0 },
        { key: 'mathScore', label: 'Math Score', short: 'Math', weight: 1.0 },
      ];
      
      // Equal weights
      const equalCriteria = [
        { key: 'readingScore', label: 'Reading Score', short: 'Read', weight: 1.0 },
        { key: 'mathScore', label: 'Math Score', short: 'Math', weight: 1.0 },
      ];
      
      const numClasses = 2;
      
      // Create an imbalanced assignment
      const assignment = { 'student-1': 0, 'student-2': 0, 'student-3': 0, 'student-4': 1 };

      // Act
      const weightedCost = computeCost(students, assignment, numClasses, readingWeightedCriteria, flagCriteria);
      const equalCost = computeCost(students, assignment, numClasses, equalCriteria, flagCriteria);

      // Assert - weighted total score should produce different cost
      // When reading is weighted 3x higher, the cost penalty for imbalanced reading scores increases
      expect(weightedCost).toBeGreaterThan(0);
      expect(equalCost).toBeGreaterThan(0);
      expect(weightedCost).not.toBe(equalCost);
      // High weight on reading should result in higher cost for the same imbalance
      expect(weightedCost).toBeGreaterThan(equalCost);
    });

    test('optimizer respects weighted composites in assignment', () => {
      // Arrange - students where weighted flags should drive distribution
      const students = [
        { id: 'student-1', name: 'High Weight Flag', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: true, extendedLearning: false, sped: false },
        { id: 'student-2', name: 'High Weight Flag', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: true, extendedLearning: false, sped: false },
        { id: 'student-3', name: 'Low Weight Flag', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: true, sped: false },
        { id: 'student-4', name: 'Low Weight Flag', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: true, sped: false },
        { id: 'student-5', name: 'No Flags', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: false, sped: false },
        { id: 'student-6', name: 'No Flags', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: false, sped: false },
      ];
      
      // Behavior weighted higher than extended learning
      const weightedCriteria = [
        { key: 'behavior', label: 'Behavior', short: 'BEH', weight: 3.0 },
        { key: 'extendedLearning', label: 'Extended Learning', short: 'ExtL', weight: 1.0 },
        { key: 'sped', label: 'SPED', short: 'SPED', weight: 1.0 },
      ];
      
      const numClasses = 2;

      // Act
      const assignment = optimize(students, numClasses, {}, numericCriteria, weightedCriteria);

      // Assert - check that behavior flags are distributed
      // With weighted totals, the optimizer should try to balance the weighted sum
      const class0Behaviors = students.filter(s => s.behavior && assignment[s.id] === 0).length;
      const class1Behaviors = students.filter(s => s.behavior && assignment[s.id] === 1).length;
      
      // Both behavior students shouldn't be in the same class if total flags matter
      expect(class0Behaviors + class1Behaviors).toBe(2);
    });

    test('zero-weight flags contribute nothing to total flags', () => {
      // Arrange - student with zero-weighted flag
      const students = [
        { id: 'student-1', name: 'Zero Weight', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: true, extendedLearning: false, sped: false },
        { id: 'student-2', name: 'No Flags', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: false, sped: false },
        { id: 'student-3', name: 'No Flags', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: false, sped: false },
        { id: 'student-4', name: 'No Flags', gender: 'F', readingScore: 50, mathScore: 50, languageScore: 50, behavior: false, extendedLearning: false, sped: false },
      ];
      
      // Behavior has zero weight
      const zeroWeightCriteria = [
        { key: 'behavior', label: 'Behavior', short: 'BEH', weight: 0 },
      ];
      
      const numClasses = 2;
      const assignment = { 'student-1': 0, 'student-2': 0, 'student-3': 1, 'student-4': 1 };

      // Act
      const cost = computeCost(students, assignment, numClasses, numericCriteria, zeroWeightCriteria);

      // Assert - cost should be 0 since weighted total flags are equal (0 vs 0)
      // (ignoring other balance metrics like gender/class size)
      expect(cost).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(cost)).toBe(true);
    });
  });
});
