import { describe, test, expect, beforeEach, vi } from 'vitest';
import { optimize, computeCost, computeSeed } from '../src/optimizer.js';

/**
 * Test suite for settings changes affecting optimization
 * 
 * This test verifies that changing criteria weights (in SettingsModal)
 * properly triggers re-optimization with the new weights.
 * 
 * Bug: When users changed flag/numeric weights after optimizing,
 * the optimization results would not update because:
 * 1. The RNG seed didn't include weights (now fixed)
 * 2. Auto-reoptimization wasn't triggered when criteria changed (now fixed)
 */

describe('Settings Changes - Optimization Updates', () => {
  let students;
  let baseNumericCriteria;
  let baseFlagCriteria;

  beforeEach(() => {
    // Create test students with varied attributes - larger dataset for meaningful tests
    students = [];
    for (let i = 0; i < 30; i++) {
      students.push({
        id: `s${i}`,
        name: `Student ${i}`,
        gender: i % 2 === 0 ? 'F' : 'M',
        readingScore: 50 + (i * 3) % 50,
        mathScore: 40 + (i * 7) % 50,
        behavior: i % 3 === 0,
      });
    }

    baseNumericCriteria = [
      { key: 'readingScore', label: 'Reading', weight: 1.0 },
      { key: 'mathScore', label: 'Math', weight: 1.0 },
    ];

    baseFlagCriteria = [
      { key: 'behavior', label: 'Behavior', weight: 1.0 },
    ];
  });

  test('changing numeric criteria weights produces different optimization results', () => {
    const numClasses = 3;
    const lockedAssignments = {};

    // First optimization with base weights
    const result1 = optimize(
      students,
      numClasses,
      lockedAssignments,
      baseNumericCriteria,
      baseFlagCriteria,
      [],
      [],
      []
    );

    // Change weights - emphasize reading score more
    const modifiedNumericCriteria = [
      { key: 'readingScore', label: 'Reading', weight: 5.0 },
      { key: 'mathScore', label: 'Math', weight: 0.5 },
    ];

    // Second optimization with modified weights
    const result2 = optimize(
      students,
      numClasses,
      lockedAssignments,
      modifiedNumericCriteria,
      baseFlagCriteria,
      [],
      [],
      []
    );

    // The results should be different because weights changed
    const assignments1 = Object.entries(result1).sort((a, b) => a[0].localeCompare(b[0]));
    const assignments2 = Object.entries(result2).sort((a, b) => a[0].localeCompare(b[0]));
    
    // At least some assignments should differ
    let differences = 0;
    for (let i = 0; i < assignments1.length; i++) {
      if (assignments1[i][1] !== assignments2[i][1]) {
        differences++;
      }
    }
    
    expect(differences).toBeGreaterThan(0);
  });

  test('changing flag criteria weights produces different optimization results', () => {
    const numClasses = 3;
    const lockedAssignments = {};

    // First optimization with base weights
    const result1 = optimize(
      students,
      numClasses,
      lockedAssignments,
      baseNumericCriteria,
      baseFlagCriteria,
      [],
      [],
      []
    );

    // Change flag weights - emphasize behavior flag more
    const modifiedFlagCriteria = [
      { key: 'behavior', label: 'Behavior', weight: 5.0 },
    ];

    // Second optimization with modified weights
    const result2 = optimize(
      students,
      numClasses,
      lockedAssignments,
      baseNumericCriteria,
      modifiedFlagCriteria,
      [],
      [],
      []
    );

    // The results should be different because weights changed
    const assignments1 = Object.entries(result1).sort((a, b) => a[0].localeCompare(b[0]));
    const assignments2 = Object.entries(result2).sort((a, b) => a[0].localeCompare(b[0]));
    
    let differences = 0;
    for (let i = 0; i < assignments1.length; i++) {
      if (assignments1[i][1] !== assignments2[i][1]) {
        differences++;
      }
    }
    
    expect(differences).toBeGreaterThan(0);
  });

  test('computeSeed includes weights in hash calculation', () => {
    const numClasses = 3;
    const lockedAssignments = {};

    // Compute seed with base weights
    const seed1 = computeSeed(
      students,
      numClasses,
      lockedAssignments,
      baseNumericCriteria,
      baseFlagCriteria,
      [],
      [],
      []
    );

    // Compute seed with modified weights
    const modifiedNumericCriteria = [
      { key: 'readingScore', label: 'Reading', weight: 5.0 },
      { key: 'mathScore', label: 'Math', weight: 0.5 },
    ];

    const seed2 = computeSeed(
      students,
      numClasses,
      lockedAssignments,
      modifiedNumericCriteria,
      baseFlagCriteria,
      [],
      [],
      []
    );

    // Seeds should be different when weights change
    expect(seed1).not.toBe(seed2);
  });

  test('computeSeed produces same seed for identical criteria', () => {
    const numClasses = 3;
    const lockedAssignments = {};

    // Compute seed twice with same criteria
    const seed1 = computeSeed(
      students,
      numClasses,
      lockedAssignments,
      baseNumericCriteria,
      baseFlagCriteria,
      [],
      [],
      []
    );

    const seed2 = computeSeed(
      students,
      numClasses,
      lockedAssignments,
      baseNumericCriteria,
      baseFlagCriteria,
      [],
      [],
      []
    );

    // Seeds should be identical for identical criteria
    expect(seed1).toBe(seed2);
  });

  test('cost calculation reflects weight changes', () => {
    const numClasses = 3;
    const lockedAssignments = {};

    // Get initial optimization result
    const result = optimize(
      students,
      numClasses,
      lockedAssignments,
      baseNumericCriteria,
      baseFlagCriteria,
      [],
      [],
      []
    );

    // Calculate cost with base weights
    const cost1 = computeCost(
      students,
      result,
      numClasses,
      baseNumericCriteria,
      baseFlagCriteria,
      [],
      [],
      []
    );

    // Calculate cost with modified weights (same assignment)
    const modifiedNumericCriteria = [
      { key: 'readingScore', label: 'Reading', weight: 5.0 },
      { key: 'mathScore', label: 'Math', weight: 0.5 },
    ];

    const cost2 = computeCost(
      students,
      result,
      numClasses,
      modifiedNumericCriteria,
      baseFlagCriteria,
      [],
      [],
      []
    );

    // Costs should be different with different weights
    expect(cost1).not.toBe(cost2);
  });

  test('locked students remain in place when criteria change', () => {
    const numClasses = 3;
    
    // Lock student 1 in class 0
    const lockedAssignments = { s0: 0 };

    // First optimization
    const result1 = optimize(
      students,
      numClasses,
      lockedAssignments,
      baseNumericCriteria,
      baseFlagCriteria,
      [],
      [],
      []
    );

    // Verify student 1 is locked
    expect(result1.s0).toBe(0);

    // Change weights
    const modifiedNumericCriteria = [
      { key: 'readingScore', label: 'Reading', weight: 5.0 },
      { key: 'mathScore', label: 'Math', weight: 0.5 },
    ];

    // Second optimization with same locked student
    const result2 = optimize(
      students,
      numClasses,
      lockedAssignments,
      modifiedNumericCriteria,
      baseFlagCriteria,
      [],
      [],
      []
    );

    // Locked student should stay in same class
    expect(result2.s0).toBe(0);
  });
});
