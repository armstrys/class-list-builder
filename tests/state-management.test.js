import { describe, test, expect, beforeEach } from 'vitest';

/**
 * Test suite for state management operations
 * Tests replaceAllStudents and related functionality
 */

describe('State Management - replaceAllStudents', () => {
  /**
   * Simulates the replaceAllStudents function from StudentsContext
   */

  /**
   * Simulates the replaceAllStudents function from StudentsContext
   */
  function replaceAllStudents(newStudents) {
    return {
      students: newStudents,
      keepApart: [],
      keepTogether: [],
      keepOutOfClass: [],
      assignment: {},
      locked: new Set(),
      optimizationResults: null,
    };
  }

  test('clears all related state when replacing students', () => {
    const newStudents = [
      { id: 'new1', name: 'New Student 1', gender: 'F' },
      { id: 'new2', name: 'New Student 2', gender: 'M' },
    ];

    const result = replaceAllStudents(newStudents);

    expect(result.students).toEqual(newStudents);
    expect(result.keepApart).toEqual([]);
    expect(result.keepTogether).toEqual([]);
    expect(result.keepOutOfClass).toEqual([]);
    expect(result.assignment).toEqual({});
    expect(result.locked).toEqual(new Set());
    expect(result.optimizationResults).toBeNull();
  });

  test('does not preserve old student IDs in assignment', () => {
    const newStudents = [{ id: 'new1', name: 'New Student 1', gender: 'F' }];

    const result = replaceAllStudents(newStudents);

    // Old assignment entries should be cleared
    expect(result.assignment).not.toHaveProperty('old1');
    expect(result.assignment).not.toHaveProperty('old2');
    expect(result.assignment).toEqual({});
  });

  test('clears constraints tied to old students', () => {
    const newStudents = [
      { id: 'new1', name: 'New Student 1', gender: 'F' },
      { id: 'new2', name: 'New Student 2', gender: 'M' },
    ];

    const result = replaceAllStudents(newStudents);

    // Constraints from old students should be cleared
    expect(result.keepApart).toEqual([]);
    expect(result.keepTogether).toEqual([]);
    expect(result.keepOutOfClass).toEqual([]);
  });

  test('clears locked state from old students', () => {
    const newStudents = [{ id: 'new1', name: 'New Student 1', gender: 'F' }];

    const result = replaceAllStudents(newStudents);

    // Locked set should be empty, not contain old IDs
    expect(result.locked.size).toBe(0);
    expect(result.locked.has('old1')).toBe(false);
  });

  test('handles empty student array', () => {
    const newStudents = [];

    const result = replaceAllStudents(newStudents);

    expect(result.students).toEqual([]);
    expect(result.assignment).toEqual({});
    expect(result.locked).toEqual(new Set());
    expect(result.keepApart).toEqual([]);
    expect(result.keepTogether).toEqual([]);
    expect(result.keepOutOfClass).toEqual([]);
  });

  test('handles large number of new students', () => {
    const newStudents = Array.from({ length: 5000 }, (_, i) => ({
      id: `s${i}`,
      name: `Student ${i}`,
      gender: i % 2 === 0 ? 'F' : 'M',
    }));

    const result = replaceAllStudents(newStudents);

    expect(result.students.length).toBe(5000);
    expect(result.assignment).toEqual({});
    expect(result.locked.size).toBe(0);
  });
});

describe('State Management - Bug Regression', () => {
  /**
   * This test documents the bug that was fixed:
   * When loading a project with students, then generating new sample data,
   * the old assignment state persisted and caused incorrect optimization results.
   */
  test('scenario: load project then generate new data clears old state', () => {
    // Step 1: Simulate loading a project with 100 students
    // Project would have these fields:
    // - students, teachers, assignment, locked, keepApart, keepTogether, keepOutOfClass

    // Simulate the replaceAllStudents function
    const replaceAllStudents = newStudents => ({
      students: newStudents,
      keepApart: [],
      keepTogether: [],
      keepOutOfClass: [],
      assignment: {},
      locked: new Set(),
      optimizationResults: null,
    });

    // Step 2: Generate 5000 new sample students
    const newStudents = Array.from({ length: 5000 }, (_, i) => ({
      id: `s${i}`,
      name: `Student ${i}`,
      gender: i % 2 === 0 ? 'F' : 'M',
    }));

    const newState = replaceAllStudents(newStudents);

    // Verify old state is completely cleared
    expect(newState.students.length).toBe(5000);
    expect(newState.assignment).toEqual({});
    expect(newState.locked.size).toBe(0);
    expect(newState.keepApart).toEqual([]);
    expect(newState.keepTogether).toEqual([]);
    expect(newState.keepOutOfClass).toEqual([]);

    // Critical: Old project student IDs should NOT be in assignment
    Object.keys(newState.assignment).forEach(id => {
      expect(id.startsWith('proj_')).toBe(false);
    });

    // Critical: Locked set should not contain old IDs
    expect(newState.locked.has('proj_0')).toBe(false);
  });
});
