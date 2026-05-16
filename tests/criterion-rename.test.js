import { describe, test, expect } from 'vitest';

/**
 * Regression test for the criterion-rename data-wipe bug.
 *
 * Before the fix, SettingsModal regenerated every criterion's `key` from its
 * `label` on save. Renaming "Reading Score" -> "Reading" produced a new key
 * (`reading`) that didn't match the old one (`readingscore`); the diff in
 * handleSaveSettings then treated the criterion as removed-then-added and
 * deleted the original field from every student.
 *
 * The fix: preserve existing keys; only newly-added criteria (empty key)
 * generate a key from their label.
 */

// Mirror generateKeyFromLabel from src/defaults.js
function generateKeyFromLabel(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^(\d)/, '_$1');
}

// Mirror SettingsModal.handleSave's criterion finalization (post-fix)
function finalizeCriteria(criteria) {
  return criteria.map(c => ({
    ...c,
    key: c.key || generateKeyFromLabel(c.label),
    weight: parseFloat(c.weight),
  }));
}

// Mirror app.js handleSaveSettings' student-field pruning
function pruneRemovedFields(students, oldCriteria, newCriteria) {
  const oldKeys = new Set(oldCriteria.map(c => c.key));
  const newKeys = new Set(newCriteria.map(c => c.key));
  const removed = [...oldKeys].filter(k => !newKeys.has(k));
  if (removed.length === 0) return students;
  return students.map(s => {
    const updated = { ...s };
    removed.forEach(k => delete updated[k]);
    return updated;
  });
}

describe('Criterion rename preserves student data', () => {
  test('renaming a label keeps the key stable', () => {
    const edited = [{ key: 'readingscore', label: 'Reading', weight: 1.0 }];
    const finalized = finalizeCriteria(edited);
    expect(finalized[0].key).toBe('readingscore');
  });

  test('renaming a label does not wipe the corresponding student field', () => {
    const oldCriteria = [{ key: 'readingscore', label: 'Reading Score', weight: 1.0 }];
    const edited = [{ key: 'readingscore', label: 'Reading', weight: 1.0 }];
    const finalized = finalizeCriteria(edited);

    const students = [
      { id: 's1', name: 'Alice', gender: 'F', readingscore: 85 },
      { id: 's2', name: 'Bob', gender: 'M', readingscore: 72 },
    ];
    const pruned = pruneRemovedFields(students, oldCriteria, finalized);

    expect(pruned[0].readingscore).toBe(85);
    expect(pruned[1].readingscore).toBe(72);
  });

  test('newly-added criterion gets a generated key from its label', () => {
    const edited = [
      { key: 'readingscore', label: 'Reading Score', weight: 1.0 },
      { key: '', label: 'Writing Score', weight: 1.0 },
    ];
    const finalized = finalizeCriteria(edited);
    expect(finalized[1].key).toBe('writingscore');
  });

  test('explicitly removed criterion still wipes its field on students', () => {
    const oldCriteria = [
      { key: 'readingscore', label: 'Reading Score', weight: 1.0 },
      { key: 'mathscore', label: 'Math Score', weight: 1.0 },
    ];
    const edited = [{ key: 'readingscore', label: 'Reading Score', weight: 1.0 }];
    const finalized = finalizeCriteria(edited);

    const students = [{ id: 's1', readingscore: 85, mathscore: 72 }];
    const pruned = pruneRemovedFields(students, oldCriteria, finalized);

    expect(pruned[0].readingscore).toBe(85);
    expect(pruned[0].mathscore).toBeUndefined();
  });

  test('label starting with a digit produces a valid key', () => {
    const edited = [{ key: '', label: '504', weight: 1.0 }];
    const finalized = finalizeCriteria(edited);
    expect(finalized[0].key).toBe('_504');
  });
});
