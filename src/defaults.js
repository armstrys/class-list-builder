const { useState, useEffect, useRef, useCallback, useMemo } = React;

// App version for save/load compatibility checking
const APP_VERSION = "1.7.5";

const DEFAULT_NUMERIC_CRITERIA = [
  { key: 'englishlanguageartsscore', label: 'English Language Arts Score', short: 'ELA', weight: 1.0 },
  { key: 'mathscore', label: 'Math Score', short: 'Math', weight: 1.0 },
  { key: 'fluency', label: 'Fluency', short: 'Fluency', weight: 1.0 },
];

const DEFAULT_FLAG_CRITERIA = [
  { key: 'behavior', label: 'Behavior', short: 'BEH', weight: 1.2 },
  { key: 'extendedlearning', label: 'Extended Learning', short: 'EXL', weight: 1.0 },
  { key: 'sped', label: 'SPED', short: 'SPED', weight: 1.2 },
  { key: '_504', label: '504', short: '504', weight: 1.0 },
  { key: 'readingintervention', label: 'Reading Intervention', short: 'ReadI', weight: 1.0 },
  { key: 'mathintervention', label: 'Math Intervention', short: 'MathI', weight: 1.0 },
  { key: 'englishlanguagelearning', label: 'English Language Learning', short: 'ELL', weight: 1.0 },
  { key: 'medicalplan', label: 'Medical Plan', short: 'Med', weight: 0.8 },
];

const STORAGE_KEYS = {
  NUMERIC_CRITERIA: 'class-optimizer-numeric-criteria',
  FLAG_CRITERIA: 'class-optimizer-flag-criteria',
};

// Optimization penalty weights
// These control the severity of constraint violations and balance metrics
const PENALTY_WEIGHTS = {
  // Constraint penalties (higher = stricter enforcement)
  KEEP_APART: 100.0, // Weight for keep-apart constraint violations
  KEEP_TOGETHER: 200.0, // Weight for keep-together constraint violations
  KEEP_OUT_OF_CLASS: 150.0, // Weight for keep-out-of-class constraint violations

  // Balance metric weights
  TOTAL_FLAGS: 2.0, // Weight for total flags balance variance
  TOTAL_SCORE: 1.5, // Weight for total z-score balance variance
  CLASS_SIZE: 3.0, // Weight for class size balance variance
  GENDER: 1.0, // Weight for gender balance variance (default, used when not specified)
};

function generateColor(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return {
    bg: `oklch(93% 0.04 ${hue})`,
    fg: `oklch(50% 0.14 ${hue})`,
    dot: `oklch(50% 0.20 ${hue})`,
  };
}

function generateKeyFromLabel(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^(\d)/, '_$1');
}
