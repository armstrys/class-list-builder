import { describe, test, expect, beforeEach } from 'vitest';
import { exportClassListsToCSV } from '../src/csv.js';

// Test helpers
let idCounter = 0;
function uid() {
  idCounter++;
  return `test-student-${idCounter}`;
}

function resetIdCounter() {
  idCounter = 0;
}

// Simulate the normalization logic from ClassColumn and StatsStrip
// This mirrors the logic used in the React components

function calculateClassColumnStats(students, allStudents, numericCriteria) {
  // From ClassColumn.js lines 4-19
  const avg = key => students.length
    ? students.reduce((s, st) => s + (st[key] || 0), 0) / students.length
    : 0;

  const popMin = key => allStudents.length ? Math.min(...allStudents.map(s => s[key] || 0)) : 0;
  const popMax = key => allStudents.length ? Math.max(...allStudents.map(s => s[key] || 0)) : 1;

  return numericCriteria.map(m => {
    const mn = popMin(m.key);
    const mx = popMax(m.key);
    const range = mx - mn || 1;
    const classAvg = avg(m.key);
    return {
      label: m.short,
      val: Math.round(classAvg),
      pct: Math.min(100, Math.max(4, (classAvg - mn) / range * 100)),
      raw: classAvg,
      min: mn,
      max: mx,
      range,
    };
  });
}

function calculateStatsStripNormalization(students, assignment, numClasses, numericCriteria) {
  // From StatsStrip.js lines 30-45
  const classes = Array.from({ length: numClasses }, (_, i) =>
    students.filter(s => assignment[s.id] === i)
  );

  return numericCriteria.map(m => {
    const allVals = students.map(s => s[m.key] || 0);
    const popMin = Math.min(...allVals);
    const popMax = Math.max(...allVals);
    const range = popMax - popMin || 1;
    const vals = classes.map(cls =>
      cls.length ? cls.reduce((s, st) => s + (st[m.key] || 0), 0) / cls.length : popMin
    );
    const normVals = vals.map(v => Math.max(0, (v - popMin) / range));

    return {
      label: m.label,
      vals: normVals,
      popMin,
      popMax,
      range,
    };
  });
}

// Mixed range criteria matching the application defaults
const mixedRangeCriteria = [
  { key: 'readingScore', label: 'Reading Score', short: 'Read', weight: 1.0 },
  { key: 'mathScore', label: 'Math Score', short: 'Math', weight: 1.0 },
  { key: 'languageScore', label: 'Language Score', short: 'Lang', weight: 1.0 },
];

describe('Display Normalization with Mixed Score Ranges', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('ClassColumn Statistics Bar Calculations', () => {
    test('correctly normalizes reading scores (0-215) to percentage bars', () => {
      // Arrange - students with reading scores 0-215
      const students = [
        { id: uid(), name: 'Alice', gender: 'F', readingScore: 0, mathScore: 2000, languageScore: 2000 },
        { id: uid(), name: 'Bob', gender: 'M', readingScore: 107, mathScore: 2500, languageScore: 2200 },
        { id: uid(), name: 'Charlie', gender: 'M', readingScore: 215, mathScore: 2900, languageScore: 2900 },
      ];

      // Act - simulate ClassColumn stats calculation
      const stats = calculateClassColumnStats(students, students, mixedRangeCriteria);
      const readingStat = stats.find(s => s.label === 'Read');

      // Assert
      expect(readingStat.min).toBe(0);
      expect(readingStat.max).toBe(215);
      expect(readingStat.range).toBe(215);
      expect(readingStat.pct).toBeGreaterThanOrEqual(4);
      expect(readingStat.pct).toBeLessThanOrEqual(100);
    });

    test('correctly normalizes math scores (2000-2900) to percentage bars', () => {
      // Arrange - students with math scores 2000-2900
      const students = [
        { id: uid(), name: 'Alice', gender: 'F', readingScore: 100, mathScore: 2000, languageScore: 2000 },
        { id: uid(), name: 'Bob', gender: 'M', readingScore: 150, mathScore: 2450, languageScore: 2450 },
        { id: uid(), name: 'Charlie', gender: 'M', readingScore: 200, mathScore: 2900, languageScore: 2900 },
      ];

      // Act
      const stats = calculateClassColumnStats(students, students, mixedRangeCriteria);
      const mathStat = stats.find(s => s.label === 'Math');

      // Assert
      expect(mathStat.min).toBe(2000);
      expect(mathStat.max).toBe(2900);
      expect(mathStat.range).toBe(900);
      expect(mathStat.pct).toBeGreaterThanOrEqual(4);
      expect(mathStat.pct).toBeLessThanOrEqual(100);
    });

    test('handles single-value population (min = max)', () => {
      // Arrange - all students have same score
      const students = [
        { id: uid(), name: 'Alice', gender: 'F', readingScore: 100, mathScore: 2500, languageScore: 2200 },
        { id: uid(), name: 'Bob', gender: 'M', readingScore: 100, mathScore: 2500, languageScore: 2200 },
        { id: uid(), name: 'Charlie', gender: 'M', readingScore: 100, mathScore: 2500, languageScore: 2200 },
      ];

      // Act
      const stats = calculateClassColumnStats(students, students, mixedRangeCriteria);
      const readingStat = stats.find(s => s.label === 'Read');

      // Assert - when min = max, range is set to 1 to avoid division by zero
      expect(readingStat.min).toBe(100);
      expect(readingStat.max).toBe(100);
      expect(readingStat.range).toBe(1); // Fallback to avoid division by zero
      expect(readingStat.pct).toBe(4); // Minimum percentage (clamped)
    });

    test('percentage is clamped between 4% and 100%', () => {
      // Arrange - extreme values that would result in very low percentages
      const allStudents = [
        { id: uid(), name: 'Low', gender: 'F', readingScore: 0, mathScore: 2000, languageScore: 2000 },
        { id: uid(), name: 'High', gender: 'M', readingScore: 215, mathScore: 2900, languageScore: 2900 },
      ];
      const classStudents = [
        { id: uid(), name: 'VeryLow', gender: 'F', readingScore: 0, mathScore: 2000, languageScore: 2000 },
      ];

      // Act
      const stats = calculateClassColumnStats(classStudents, allStudents, mixedRangeCriteria);
      const readingStat = stats.find(s => s.label === 'Read');

      // Assert - minimum percentage should be 4%
      expect(readingStat.pct).toBeGreaterThanOrEqual(4);
      expect(readingStat.pct).toBeLessThanOrEqual(100);
    });

    test('percentage is capped at 100%', () => {
      // Arrange - student with score higher than calculated max (shouldn't happen but test robustness)
      const allStudents = [
        { id: uid(), name: 'Std', gender: 'F', readingScore: 100, mathScore: 2500, languageScore: 2200 },
      ];
      const classStudents = [
        { id: uid(), name: 'High', gender: 'M', readingScore: 150, mathScore: 2800, languageScore: 2500 },
      ];

      // Act
      const stats = calculateClassColumnStats(classStudents, allStudents, mixedRangeCriteria);
      const readingStat = stats.find(s => s.label === 'Read');

      // Assert - percentage should not exceed 100%
      expect(readingStat.pct).toBeLessThanOrEqual(100);
    });

    test('correctly calculates values for multiple classes with different ranges', () => {
      // Arrange - 2 classes with different score distributions
      const allStudents = [];
      for (let i = 0; i < 20; i++) {
        allStudents.push({
          id: uid(),
          name: `Student ${i + 1}`,
          gender: 'F',
          readingScore: i * 10, // 0-190
          mathScore: 2000 + i * 50, // 2000-2950
          languageScore: 2100 + i * 40, // 2100-2860
        });
      }

      // Split into two classes
      const class1 = allStudents.slice(0, 10);
      const class2 = allStudents.slice(10, 20);

      // Act
      const stats1 = calculateClassColumnStats(class1, allStudents, mixedRangeCriteria);
      const stats2 = calculateClassColumnStats(class2, allStudents, mixedRangeCriteria);

      // Assert - both classes should have valid percentages
      [...stats1, ...stats2].forEach(stat => {
        expect(stat.pct).toBeGreaterThanOrEqual(4);
        expect(stat.pct).toBeLessThanOrEqual(100);
        expect(stat.range).toBeGreaterThan(0);
      });

      // Class 1 should have lower average reading scores
      expect(stats1.find(s => s.label === 'Read').raw).toBeLessThan(
        stats2.find(s => s.label === 'Read').raw
      );
    });
  });

  describe('StatsStrip Normalization', () => {
    test('normalizes class means to 0-1 scale for display bars', () => {
      // Arrange - 3 classes with varying math scores
      const students = [];
      const assignment = {};

      // Class 0: low scores
      for (let i = 0; i < 5; i++) {
        const id = uid();
        students.push({
          id,
          name: `Low${i}`,
          gender: 'F',
          readingScore: 50,
          mathScore: 2100,
          languageScore: 2200,
        });
        assignment[id] = 0;
      }

      // Class 1: medium scores
      for (let i = 0; i < 5; i++) {
        const id = uid();
        students.push({
          id,
          name: `Med${i}`,
          gender: 'F',
          readingScore: 100,
          mathScore: 2500,
          languageScore: 2450,
        });
        assignment[id] = 1;
      }

      // Class 2: high scores
      for (let i = 0; i < 5; i++) {
        const id = uid();
        students.push({
          id,
          name: `High${i}`,
          gender: 'F',
          readingScore: 200,
          mathScore: 2900,
          languageScore: 2800,
        });
        assignment[id] = 2;
      }

      // Act
      const normalized = calculateStatsStripNormalization(students, assignment, 3, mixedRangeCriteria);
      const mathNorm = normalized.find(n => n.label === 'Math Score');

      // Assert
      expect(mathNorm.popMin).toBe(2100);
      expect(mathNorm.popMax).toBe(2900);
      expect(mathNorm.range).toBe(800);

      // Values should be normalized to 0-1
      expect(mathNorm.vals[0]).toBeCloseTo(0, 1); // Class 0 (lowest)
      expect(mathNorm.vals[2]).toBeCloseTo(1, 1); // Class 2 (highest)
      expect(mathNorm.vals[1]).toBeGreaterThan(0);
      expect(mathNorm.vals[1]).toBeLessThan(1);
    });

    test('handles empty classes gracefully', () => {
      // Arrange - one class is empty
      const students = [
        { id: uid(), name: 'Alice', gender: 'F', readingScore: 100, mathScore: 2500, languageScore: 2200 },
        { id: uid(), name: 'Bob', gender: 'M', readingScore: 150, mathScore: 2600, languageScore: 2300 },
      ];
      const assignment = {
        [students[0].id]: 0,
        [students[1].id]: 1,
        // Class 2 is empty
      };

      // Act
      const normalized = calculateStatsStripNormalization(students, assignment, 3, mixedRangeCriteria);

      // Assert - should not throw
      normalized.forEach(n => {
        expect(n.vals).toHaveLength(3);
        expect(n.range).toBeGreaterThan(0);
      });
    });

    test('handles mixed ranges in same visualization', () => {
      // Arrange - students with mixed ranges
      const students = [];
      for (let i = 0; i < 12; i++) {
        students.push({
          id: uid(),
          name: `Student ${i + 1}`,
          gender: 'F',
          readingScore: i * 18, // 0-198
          mathScore: 2000 + i * 75, // 2000-2825
          languageScore: 2000 + i * 80, // 2000-2880
        });
      }

      const assignment = {};
      students.forEach((s, i) => {
        assignment[s.id] = i % 3; // Distribute across 3 classes
      });

      // Act
      const normalized = calculateStatsStripNormalization(students, assignment, 3, mixedRangeCriteria);

      // Assert - each criterion should be normalized independently
      normalized.forEach(n => {
        expect(n.range).toBeGreaterThan(0);
        n.vals.forEach(v => {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        });
      });

      // Verify ranges are different
      const reading = normalized.find(n => n.label === 'Reading Score');
      const math = normalized.find(n => n.label === 'Math Score');
      const language = normalized.find(n => n.label === 'Language Score');

      expect(reading.range).toBe(198);
      expect(math.range).toBe(825);
      expect(language.range).toBe(880);
    });
  });

  describe('Display Accuracy with Mixed Ranges', () => {
    test('accurately displays averages in CSV export', () => {
      // Arrange
      const students = [
        { id: 's1', name: 'Alice', gender: 'F', readingScore: 150, mathScore: 2500, languageScore: 2200, behavior: false, sped: false },
        { id: 's2', name: 'Bob', gender: 'M', readingScore: 200, mathScore: 2800, languageScore: 2750, behavior: true, sped: false },
      ];
      const assignment = { 's1': 0, 's2': 0 };
      const teachers = [{ name: 'Mrs. Smith' }];

      // Act
      const csv = exportClassListsToCSV(students, assignment, teachers, mixedRangeCriteria, []);

      // Assert
      expect(csv).toContain('150');
      expect(csv).toContain('200');
      expect(csv).toContain('2500');
      expect(csv).toContain('2800');
      expect(csv).toContain('2200');
      expect(csv).toContain('2750');
    });

    test('displays decimal scores accurately', () => {
      // Arrange
      const students = [
        { id: 's1', name: 'Alice', gender: 'F', readingScore: 150.75, mathScore: 2500.33, languageScore: 2200.99, behavior: false, sped: false },
      ];
      const assignment = { 's1': 0 };
      const teachers = [{ name: 'Teacher' }];

      // Act
      const csv = exportClassListsToCSV(students, assignment, teachers, mixedRangeCriteria, []);

      // Assert - decimal values should be preserved
      expect(csv).toContain('150.75');
      expect(csv).toContain('2500.33');
      expect(csv).toContain('2200.99');
    });

    test('ClassColumn averages are rounded for display', () => {
      // Arrange - students with non-round averages
      const students = [
        { id: uid(), name: 'Alice', gender: 'F', readingScore: 150, mathScore: 2500, languageScore: 2200 },
        { id: uid(), name: 'Bob', gender: 'M', readingScore: 151, mathScore: 2501, languageScore: 2201 },
      ];

      // Act - simulate ClassColumn calculation
      const stats = calculateClassColumnStats(students, students, mixedRangeCriteria);

      // Assert - values are rounded (val is rounded integer)
      stats.forEach(stat => {
        expect(stat.val).toBe(Math.round(stat.raw));
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles very small ranges (min and max differ by 1)', () => {
      const students = [
        { id: uid(), name: 'Alice', gender: 'F', readingScore: 100, mathScore: 2000, languageScore: 2200 },
        { id: uid(), name: 'Bob', gender: 'M', readingScore: 101, mathScore: 2001, languageScore: 2201 },
      ];

      const stats = calculateClassColumnStats(students, students, mixedRangeCriteria);
      const readingStat = stats.find(s => s.label === 'Read');

      expect(readingStat.range).toBe(1);
      expect(readingStat.pct).toBeGreaterThanOrEqual(4);
      expect(readingStat.pct).toBeLessThanOrEqual(100);
    });

    test('handles zero values correctly', () => {
      const students = [
        { id: uid(), name: 'Alice', gender: 'F', readingScore: 0, mathScore: 2000, languageScore: 2000 },
        { id: uid(), name: 'Bob', gender: 'M', readingScore: 100, mathScore: 2500, languageScore: 2500 },
      ];

      const stats = calculateClassColumnStats(students, students, mixedRangeCriteria);
      const readingStat = stats.find(s => s.label === 'Read');

      expect(readingStat.min).toBe(0);
      expect(readingStat.max).toBe(100);
      // Class with 0 reading score should have 4% (minimum) percentage
      const zeroScoreStats = calculateClassColumnStats([students[0]], students, mixedRangeCriteria);
      const zeroReadingStat = zeroScoreStats.find(s => s.label === 'Read');
      expect(zeroReadingStat.pct).toBe(4);
    });

    test('handles negative scores in normalization', () => {
      const students = [
        { id: uid(), name: 'Low', gender: 'F', readingScore: -100, mathScore: 2000, languageScore: 2000 },
        { id: uid(), name: 'High', gender: 'M', readingScore: 100, mathScore: 2900, languageScore: 2900 },
      ];

      const stats = calculateClassColumnStats(students, students, mixedRangeCriteria);
      const readingStat = stats.find(s => s.label === 'Read');

      expect(readingStat.min).toBe(-100);
      expect(readingStat.max).toBe(100);
      expect(readingStat.range).toBe(200);
    });

    test('handles extremely large ranges', () => {
      const students = [
        { id: uid(), name: 'Low', gender: 'F', readingScore: 0, mathScore: 0, languageScore: 0 },
        { id: uid(), name: 'High', gender: 'M', readingScore: 1000000, mathScore: 1000000, languageScore: 1000000 },
      ];

      const stats = calculateClassColumnStats(students, students, mixedRangeCriteria);

      stats.forEach(stat => {
        expect(stat.range).toBe(1000000);
        expect(stat.pct).toBeGreaterThanOrEqual(4);
        expect(stat.pct).toBeLessThanOrEqual(100);
      });
    });
  });
});
