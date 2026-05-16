import { describe, test, expect } from 'vitest';
import { optimize, computeCost } from '../src/optimizer.js';
import { serializeProject } from '../src/utils/projectSerializer.js';
import { deserializeProject } from '../src/utils/projectDeserializer.js';
import { exportStudentsToCSV, parseCSV } from '../src/csv.js';

// Custom non-default criteria to ensure configuration works end-to-end
const customNumericCriteria = [
  { key: 'scienceScore', label: 'Science Score', weight: 1.0 },
  { key: 'artScore', label: 'Art Score', weight: 1.5 },
];

const customFlagCriteria = [
  { key: 'gifted', label: 'Gifted', weight: 2.0 },
  { key: 'ell', label: 'English Language Learner', weight: 1.0 },
];

const teachers = [
  { id: 'T1', name: 'Class A' },
  { id: 'T2', name: 'Class B' },
];

const students = [
  { id: 's1', name: 'Alice', gender: 'F', scienceScore: 85, artScore: 90, gifted: false, ell: false },
  { id: 's2', name: 'Bob',   gender: 'M', scienceScore: 78, artScore: 82, gifted: true,  ell: false },
  { id: 's3', name: 'Cara',  gender: 'F', scienceScore: 92, artScore: 88, gifted: false, ell: true },
  { id: 's4', name: 'Dan',   gender: 'M', scienceScore: 70, artScore: 75, gifted: false, ell: false },
];

describe('Custom Criteria End-to-End', () => {
  test('optimizes with custom numeric and flag criteria', () => {
    const assignment = optimize(
      students,
      2, // 2 classes
      {}, // no locked assignments
      customNumericCriteria,
      customFlagCriteria,
      [], // no keepApart
      [], // no keepTogether
      []  // no keepOutOfClass
    );

    // Should assign all students
    expect(Object.keys(assignment)).toHaveLength(4);
    expect(assignment['s1']).toBeDefined();
    expect(assignment['s2']).toBeDefined();
    expect(assignment['s3']).toBeDefined();
    expect(assignment['s4']).toBeDefined();

    // Should use valid class indices
    expect(assignment['s1']).toBeGreaterThanOrEqual(0);
    expect(assignment['s1']).toBeLessThan(2);
  });

  test('computeCost works with custom criteria', () => {
    const assignment = { s1: 0, s2: 0, s3: 1, s4: 1 };
    const cost = computeCost(
      students,
      assignment,
      2,
      customNumericCriteria,
      customFlagCriteria,
      [], [], []
    );

    expect(typeof cost).toBe('number');
    expect(cost).toBeGreaterThan(0);
  });

  test('project save/load preserves custom criteria', () => {
    const state = {
      students,
      teachers,
      numericCriteria: customNumericCriteria,
      flagCriteria: customFlagCriteria,
      keepApart: [],
      keepTogether: [],
      keepOutOfClass: [],
      assignment: { s1: 0, s2: 1, s3: 0, s4: 1 },
      locked: [],
    };

    const serialized = serializeProject(state);
    const result = deserializeProject(serialized, {
      currentVersion: '1.7.7',
      currentNumCriteria: customNumericCriteria,
      currentFlagCriteria: customFlagCriteria,
    });

    expect(result.canLoad).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data.numericCriteria).toEqual(customNumericCriteria);
    expect(result.data.flagCriteria).toEqual(customFlagCriteria);
  });

  test('CSV export uses custom criteria labels as headers', () => {
    const csv = exportStudentsToCSV(students, customNumericCriteria, customFlagCriteria);
    const lines = csv.split('\n');
    const header = lines[0];

    // Headers should use the label, not the key
    expect(header).toContain('Science Score');
    expect(header).toContain('Art Score');
    expect(header).toContain('Gifted');
    expect(header).toContain('English Language Learner');

    // Should NOT contain the raw keys
    expect(header).not.toContain('scienceScore');
    expect(header).not.toContain('artScore');
    expect(header).not.toContain('gifted');
    expect(header).not.toContain('ell');
  });

  test('CSV round-trip preserves custom criteria data', () => {
    const csv = exportStudentsToCSV(students, customNumericCriteria, customFlagCriteria);
    const result = parseCSV(csv, customNumericCriteria, customFlagCriteria);

    expect(result.errors).toEqual([]);
    expect(result.students).toHaveLength(4);

    // Verify data preserved
    const alice = result.students.find(s => s.name === 'Alice');
    expect(alice.scienceScore).toBe(85);
    expect(alice.artScore).toBe(90);
    expect(alice.gifted).toBe(false);
    expect(alice.ell).toBe(false);

    const bob = result.students.find(s => s.name === 'Bob');
    expect(bob.scienceScore).toBe(78);
    expect(bob.gifted).toBe(true);
  });

  test('optimization with custom criteria produces deterministic results', () => {
    const assignment1 = optimize(
      students, 2, {}, customNumericCriteria, customFlagCriteria, [], [], []
    );
    const assignment2 = optimize(
      students, 2, {}, customNumericCriteria, customFlagCriteria, [], [], []
    );

    expect(assignment1).toEqual(assignment2);
  });
});
