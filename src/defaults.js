const { useState, useEffect, useRef, useCallback, useMemo, useId } = React;

// App version for save/load compatibility checking
const APP_VERSION = "2.2.1";

const DEFAULT_NUMERIC_CRITERIA = [
  { key: 'englishlanguageartsscore', label: 'English Language Arts Score', weight: 1.0 },
  { key: 'mathscore', label: 'Math Score', weight: 1.0 },
  { key: 'fluency', label: 'Fluency Score', weight: 1.0 },
];

const DEFAULT_FLAG_CRITERIA = [
  { key: 'behavior', label: 'Behavior', weight: 1.2 },
  { key: 'extendedlearning', label: 'Extended Learning', weight: 1.0 },
  { key: 'sped', label: 'SPED', weight: 1.2 },
  { key: '_504', label: '504', weight: 1.0 },
  { key: 'readingintervention', label: 'Reading Intervention', weight: 1.0 },
  { key: 'mathintervention', label: 'Math Intervention', weight: 1.0 },
  { key: 'englishlanguagelearning', label: 'English Language Learning', weight: 1.0 },
  { key: 'medicalplan', label: 'Medical Plan', weight: 0.8 },
];

const STORAGE_KEYS = {
  NUMERIC_CRITERIA: 'classOptimizer_numericCriteria_v2',
  FLAG_CRITERIA: 'classOptimizer_flagCriteria_v2',
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

// 12 named-color hue anchors (red, orange, amber, yellow, lime, green, teal,
// cyan, blue, indigo, purple, pink). Uneven spacing is intentional: each slot
// is a recognizable color, so adjacent badges read as distinctly different —
// "blue vs cyan" lands better than "hue 240 vs hue 218".
const FLAG_HUE_PALETTE = [
  25, 50, 75, 95, 130, 155, 185, 215, 250, 280, 310, 340,
];

function generateColor(key, index, theme) {
  // Position-based assignment guarantees the first N (N = palette length)
  // flags get unique colors. Hash-based fallback exists for callers that
  // don't have an index, but it can collide — e.g. with 6 flags and a
  // 12-slot palette, expected collisions ≈ 1.5.
  let slot;
  if (typeof index === 'number' && index >= 0) {
    slot = index % FLAG_HUE_PALETTE.length;
  } else {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    slot = Math.abs(hash) % FLAG_HUE_PALETTE.length;
  }
  const hue = FLAG_HUE_PALETTE[slot];
  // theme: 'light' | 'dark' | undefined. Undefined = auto-detect from
  // the document; an explicit value lets callers (e.g. print) override.
  const isDark = theme === undefined
    ? typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
    : theme === 'dark';
  if (isDark) {
    return {
      bg: `oklch(32% 0.10 ${hue})`,
      fg: `oklch(86% 0.15 ${hue})`,
      dot: `oklch(74% 0.20 ${hue})`,
    };
  }
  return {
    bg: `oklch(88% 0.11 ${hue})`,
    fg: `oklch(40% 0.20 ${hue})`,
    dot: `oklch(56% 0.24 ${hue})`,
  };
}

function generateKeyFromLabel(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^(\d)/, '_$1');
}

function buildPrintReportData(
  students,
  assignment,
  locked,
  keepApart,
  keepTogether,
  keepOutOfClass,
  teachers,
  numericCriteria,
  flagCriteria
) {
  const numClasses = teachers.length;
  const classes = Array.from({ length: numClasses }, (_, i) =>
    students.filter(s => assignment[s.id] === i).sort((a, b) => a.name.localeCompare(b.name))
  );

  const classPages = classes.map((classStudents, i) => {
    const teacherName = teachers[i]?.name || `Class ${i + 1}`;
    const mCount = classStudents.filter(s => s.gender === 'M').length;
    const fCount = classStudents.filter(s => s.gender === 'F').length;
    const uCount = classStudents.filter(s => s.gender === 'U' || !s.gender).length;

    const numericStats = numericCriteria.map(c => {
      const values = classStudents.map(s => s[c.key] || 0);
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return { key: c.key, label: c.label, avg: Math.round(avg * 10) / 10 };
    });

    const flagStats = flagCriteria.map((c, idx) => ({
      key: c.key,
      label: c.label,
      count: classStudents.filter(s => s[c.key]).length,
      colors: generateColor(c.key, idx, 'light'),
    }));

    const totalFlagsCount = classStudents.reduce(
      (sum, s) => sum + flagCriteria.reduce((fs, { key }) => fs + (s[key] ? 1 : 0), 0),
      0
    );

    const studentRows = classStudents.map((s, idx) => {
      const isLocked = locked.has(s.id);
      const hasKeepApart = keepApart.some(([id1, id2]) => id1 === s.id || id2 === s.id);
      const hasKeepTogether = keepTogether.some(group => group.includes(s.id));
      const hasKeepOutOfClass = keepOutOfClass.some(c => c.studentId === s.id);
      return {
        ...s,
        index: idx + 1,
        isLocked,
        hasConstraints: hasKeepApart || hasKeepTogether || hasKeepOutOfClass,
      };
    });

    return {
      classIndex: i,
      teacherName,
      studentCount: classStudents.length,
      mCount, fCount, uCount,
      numericStats, flagStats, totalFlagsCount,
      studentRows,
    };
  });

  // Look up student names for the constraint summary on the cover page.
  // Constraints are stored by id; the report shows names.
  const nameOf = id => students.find(s => s.id === id)?.name || `(unknown ${id})`;
  const constraintSummary = {
    keepTogether: keepTogether.map(group => group.map(nameOf)),
    keepApart: keepApart.map(([a, b]) => [nameOf(a), nameOf(b)]),
    keepOutOfClass: keepOutOfClass.map(c => ({
      name: nameOf(c.studentId),
      teacherName: teachers[c.classIndex]?.name || `Class ${c.classIndex + 1}`,
    })),
  };

  return {
    generatedAt: new Date().toLocaleString(),
    totalStudents: students.length,
    totalAssigned: Object.keys(assignment).length,
    numClasses,
    classPages,
    constraintSummary,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildPrintReportData, generateColor, generateKeyFromLabel };
}
