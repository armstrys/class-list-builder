const { useState, useEffect, useRef } = React;

const DEFAULT_NUMERIC_CRITERIA = [
  { key: 'readingScore', label: 'Reading Score', short: 'Read', weight: 1.0 },
  { key: 'mathScore', label: 'Math Score', short: 'Math', weight: 1.0 },
  { key: 'languageScore', label: 'Language Score', short: 'Lang', weight: 1.0 },
];

const DEFAULT_FLAG_CRITERIA = [
  { key: 'behavior', label: 'Behavior', short: 'BEH', weight: 2.0 },
  { key: 'extendedLearning', label: 'Extended Learning', short: 'ExtL', weight: 1.5 },
  { key: 'sped', label: 'SPED', short: 'SPED', weight: 2.0 },
  { key: '504', label: '504', short: '504', weight: 1.5 },
  { key: 'readingIntervention', label: 'Reading Intervention', short: 'RdgI', weight: 1.5 },
  { key: 'mathIntervention', label: 'Math Intervention', short: 'MathI', weight: 1.5 },
  { key: 'englishLanguageLearning', label: 'English Language Learning', short: 'ELL', weight: 1.5 },
  { key: 'medicalPlan', label: 'Medical Plan', short: 'Med', weight: 1.0 },
];

const STORAGE_KEYS = {
  NUMERIC_CRITERIA: 'class-optimizer-numeric-criteria',
  FLAG_CRITERIA: 'class-optimizer-flag-criteria',
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
