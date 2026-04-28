import { describe, test, expect } from 'vitest';
import { serializeProject } from '../src/utils/projectSerializer.js';
import { deserializeProject } from '../src/utils/projectDeserializer.js';

const numericCriteria = [
  { key: 'readingScore', label: 'Reading Score', short: 'Read', weight: 1.0 },
  { key: 'mathScore', label: 'Math Score', short: 'Math', weight: 1.0 },
];

const flagCriteria = [
  { key: 'behavior', label: 'Behavior', short: 'BEH', weight: 2.0 },
  { key: 'sped', label: 'SPED', short: 'SPED', weight: 2.0 },
];

const teachers = [
  { id: 'T1', name: 'Class A' },
  { id: 'T2', name: 'Class B' },
  { id: 'T3', name: 'Class C' },
];

const students = [
  { id: 's1', name: 'Alice', gender: 'F', readingScore: 85, mathScore: 90, behavior: false, sped: false },
  { id: 's2', name: 'Bob',   gender: 'M', readingScore: 78, mathScore: 82, behavior: true,  sped: false },
  { id: 's3', name: 'Cara',  gender: 'F', readingScore: 92, mathScore: 88, behavior: false, sped: true },
  { id: 's4', name: 'Dan',   gender: 'M', readingScore: 70, mathScore: 75, behavior: false, sped: false },
];

const fullState = {
  students,
  teachers,
  numericCriteria,
  flagCriteria,
  keepApart: [['s1', 's2']],
  keepTogether: [['s3', 's4']],
  keepOutOfClass: [{ studentId: 's1', classIndex: 2 }],
  assignment: { s1: 0, s2: 1, s3: 2, s4: 2 },
  locked: ['s1', 's3'],
};

describe('Project save/load round-trip', () => {
  test('preserves all load-bearing fields through serialize → deserialize', () => {
    const serialized = serializeProject(fullState);
    const result = deserializeProject(serialized, {
      currentVersion: '1.5.1',
      currentNumCriteria: numericCriteria,
      currentFlagCriteria: flagCriteria,
    });

    expect(result.canLoad).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data).not.toBeNull();

    const { data } = result;

    expect(data.students).toEqual(students);
    expect(data.teachers).toEqual(teachers);
    expect(data.keepApart).toEqual(fullState.keepApart);
    expect(data.keepTogether).toEqual(fullState.keepTogether);
    expect(data.keepOutOfClass).toEqual(fullState.keepOutOfClass);
    expect(data.assignment).toEqual(fullState.assignment);
    expect(data.locked).toEqual(fullState.locked);
  });

  test('locked array survives even when assignment is empty', () => {
    const serialized = serializeProject({
      ...fullState,
      assignment: {},
    });
    const result = deserializeProject(serialized, {
      currentVersion: '1.5.1',
      currentNumCriteria: numericCriteria,
      currentFlagCriteria: flagCriteria,
    });

    expect(result.canLoad).toBe(true);
    expect(result.data.locked).toEqual(['s1', 's3']);
    expect(result.data.assignment).toEqual({});
  });

  test('keepOutOfClass survives the round-trip (regression)', () => {
    const serialized = serializeProject(fullState);
    const result = deserializeProject(serialized, {
      currentVersion: '1.5.1',
      currentNumCriteria: numericCriteria,
      currentFlagCriteria: flagCriteria,
    });

    expect(result.data.keepOutOfClass).toEqual([{ studentId: 's1', classIndex: 2 }]);
  });

  test('drops locked entries for students that were not loaded', () => {
    const serialized = serializeProject({
      ...fullState,
      locked: ['s1', 'ghost-id'],
    });
    const result = deserializeProject(serialized, {
      currentVersion: '1.5.1',
      currentNumCriteria: numericCriteria,
      currentFlagCriteria: flagCriteria,
    });

    expect(result.data.locked).toEqual(['s1']);
  });

  test('drops assignment entries for invalid teacher indices', () => {
    const serialized = serializeProject({
      ...fullState,
      assignment: { s1: 0, s2: 99, s3: 2, s4: -1 },
    });
    const result = deserializeProject(serialized, {
      currentVersion: '1.5.1',
      currentNumCriteria: numericCriteria,
      currentFlagCriteria: flagCriteria,
    });

    expect(result.data.assignment).toEqual({ s1: 0, s3: 2 });
  });
});
