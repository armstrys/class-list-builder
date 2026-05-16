import { describe, test, expect, vi } from 'vitest';

// Mock React globally before importing defaults.js (it destructures hooks at the top level)
globalThis.React = {
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useCallback: vi.fn(f => f),
  useMemo: vi.fn(f => f()),
  useId: vi.fn(),
};

const { buildPrintReportData, generateColor } = await import('../src/defaults.js');

const numericCriteria = [
  { key: 'readingScore', label: 'Reading Score', weight: 1.0 },
  { key: 'mathScore', label: 'Math Score', weight: 1.0 },
];

const flagCriteria = [
  { key: 'behavior', label: 'Behavior', weight: 2.0 },
  { key: 'sped', label: 'SPED', weight: 2.0 },
];

describe('Print Report', () => {
  test('buildPrintReportData returns correct summary stats', () => {
    const students = [
      {
        id: 's1',
        name: 'Alice',
        gender: 'F',
        readingScore: 80,
        mathScore: 90,
        behavior: true,
        sped: false,
      },
      {
        id: 's2',
        name: 'Bob',
        gender: 'M',
        readingScore: 70,
        mathScore: 85,
        behavior: false,
        sped: true,
      },
      {
        id: 's3',
        name: 'Carol',
        gender: 'F',
        readingScore: 95,
        mathScore: 88,
        behavior: false,
        sped: false,
      },
    ];
    const assignment = { s1: 0, s2: 0, s3: 1 };
    const locked = new Set(['s1']);
    const keepApart = [];
    const keepTogether = [];
    const keepOutOfClass = [];
    const teachers = [{ name: 'Ms. Smith' }, { name: 'Mr. Jones' }];

    const data = buildPrintReportData(
      students,
      assignment,
      locked,
      keepApart,
      keepTogether,
      keepOutOfClass,
      teachers,
      numericCriteria,
      flagCriteria
    );

    expect(data.totalStudents).toBe(3);
    expect(data.totalAssigned).toBe(3);
    expect(data.numClasses).toBe(2);
    expect(data.classPages).toHaveLength(2);
    expect(data.generatedAt).toBeTruthy();
  });

  test('buildPrintReportData groups students by assignment correctly', () => {
    const students = [
      {
        id: 's1',
        name: 'Alice',
        gender: 'F',
        readingScore: 80,
        mathScore: 90,
        behavior: true,
        sped: false,
      },
      {
        id: 's2',
        name: 'Bob',
        gender: 'M',
        readingScore: 70,
        mathScore: 85,
        behavior: false,
        sped: true,
      },
      {
        id: 's3',
        name: 'Carol',
        gender: 'F',
        readingScore: 95,
        mathScore: 88,
        behavior: false,
        sped: false,
      },
    ];
    const assignment = { s1: 0, s2: 0, s3: 1 };
    const locked = new Set();
    const keepApart = [];
    const keepTogether = [];
    const keepOutOfClass = [];
    const teachers = [{ name: 'Ms. Smith' }, { name: 'Mr. Jones' }];

    const data = buildPrintReportData(
      students,
      assignment,
      locked,
      keepApart,
      keepTogether,
      keepOutOfClass,
      teachers,
      numericCriteria,
      flagCriteria
    );

    // Class 0: Alice + Bob
    expect(data.classPages[0].studentCount).toBe(2);
    expect(data.classPages[0].studentRows.map(r => r.name)).toEqual(['Alice', 'Bob']);
    // Class 1: Carol
    expect(data.classPages[1].studentCount).toBe(1);
    expect(data.classPages[1].studentRows.map(r => r.name)).toEqual(['Carol']);
  });

  test('buildPrintReportData calculates numeric averages correctly', () => {
    const students = [
      {
        id: 's1',
        name: 'Alice',
        gender: 'F',
        readingScore: 80,
        mathScore: 90,
        behavior: false,
        sped: false,
      },
      {
        id: 's2',
        name: 'Bob',
        gender: 'M',
        readingScore: 70,
        mathScore: 85,
        behavior: false,
        sped: false,
      },
    ];
    const assignment = { s1: 0, s2: 0 };
    const locked = new Set();
    const constraints = { keepApart: [], keepTogether: [], keepOutOfClass: [] };
    const teachers = [{ name: 'Ms. Smith' }];

    const data = buildPrintReportData(
      students,
      assignment,
      locked,
      constraints.keepApart,
      constraints.keepTogether,
      constraints.keepOutOfClass,
      teachers,
      numericCriteria,
      flagCriteria
    );

    const readingAvg = data.classPages[0].numericStats.find(s => s.key === 'readingScore').avg;
    const mathAvg = data.classPages[0].numericStats.find(s => s.key === 'mathScore').avg;
    expect(readingAvg).toBe(75); // (80 + 70) / 2
    expect(mathAvg).toBe(88); // (90 + 85) / 2
  });

  test('buildPrintReportData calculates flag counts correctly', () => {
    const students = [
      {
        id: 's1',
        name: 'Alice',
        gender: 'F',
        readingScore: 0,
        mathScore: 0,
        behavior: true,
        sped: false,
      },
      {
        id: 's2',
        name: 'Bob',
        gender: 'M',
        readingScore: 0,
        mathScore: 0,
        behavior: true,
        sped: true,
      },
      {
        id: 's3',
        name: 'Carol',
        gender: 'F',
        readingScore: 0,
        mathScore: 0,
        behavior: false,
        sped: false,
      },
    ];
    const assignment = { s1: 0, s2: 0, s3: 0 };
    const locked = new Set();
    const constraints = { keepApart: [], keepTogether: [], keepOutOfClass: [] };
    const teachers = [{ name: 'Ms. Smith' }];

    const data = buildPrintReportData(
      students,
      assignment,
      locked,
      constraints.keepApart,
      constraints.keepTogether,
      constraints.keepOutOfClass,
      teachers,
      numericCriteria,
      flagCriteria
    );

    const behaviorStat = data.classPages[0].flagStats.find(s => s.key === 'behavior');
    const spedStat = data.classPages[0].flagStats.find(s => s.key === 'sped');
    expect(behaviorStat.count).toBe(2);
    expect(spedStat.count).toBe(1);
    expect(data.classPages[0].totalFlagsCount).toBe(3);
  });

  test('buildPrintReportData tracks locked students correctly', () => {
    const students = [
      {
        id: 's1',
        name: 'Alice',
        gender: 'F',
        readingScore: 0,
        mathScore: 0,
        behavior: false,
        sped: false,
      },
      {
        id: 's2',
        name: 'Bob',
        gender: 'M',
        readingScore: 0,
        mathScore: 0,
        behavior: false,
        sped: false,
      },
    ];
    const assignment = { s1: 0, s2: 0 };
    const locked = new Set(['s1']);
    const constraints = { keepApart: [], keepTogether: [], keepOutOfClass: [] };
    const teachers = [{ name: 'Ms. Smith' }];

    const data = buildPrintReportData(
      students,
      assignment,
      locked,
      constraints.keepApart,
      constraints.keepTogether,
      constraints.keepOutOfClass,
      teachers,
      numericCriteria,
      flagCriteria
    );

    expect(data.classPages[0].studentRows[0].isLocked).toBe(true);
    expect(data.classPages[0].studentRows[1].isLocked).toBe(false);
  });

  test('buildPrintReportData tracks constraint students correctly', () => {
    const students = [
      {
        id: 's1',
        name: 'Alice',
        gender: 'F',
        readingScore: 0,
        mathScore: 0,
        behavior: false,
        sped: false,
      },
      {
        id: 's2',
        name: 'Bob',
        gender: 'M',
        readingScore: 0,
        mathScore: 0,
        behavior: false,
        sped: false,
      },
      {
        id: 's3',
        name: 'Carol',
        gender: 'F',
        readingScore: 0,
        mathScore: 0,
        behavior: false,
        sped: false,
      },
    ];
    const assignment = { s1: 0, s2: 0, s3: 0 };
    const locked = new Set();
    const keepApart = [['s1', 's2']];
    const keepTogether = [['s2', 's3']];
    const keepOutOfClass = [{ studentId: 's1', classIndex: 1 }];
    const teachers = [{ name: 'Ms. Smith' }];

    const data = buildPrintReportData(
      students,
      assignment,
      locked,
      keepApart,
      keepTogether,
      keepOutOfClass,
      teachers,
      numericCriteria,
      flagCriteria
    );

    // Alice: keepApart + keepOutOfClass
    expect(data.classPages[0].studentRows[0].hasConstraints).toBe(true);
    // Bob: keepApart + keepTogether
    expect(data.classPages[0].studentRows[1].hasConstraints).toBe(true);
    // Carol: keepTogether only
    expect(data.classPages[0].studentRows[2].hasConstraints).toBe(true);
  });

  test('buildPrintReportData shows gender counts correctly', () => {
    const students = [
      {
        id: 's1',
        name: 'Alice',
        gender: 'F',
        readingScore: 0,
        mathScore: 0,
        behavior: false,
        sped: false,
      },
      {
        id: 's2',
        name: 'Bob',
        gender: 'M',
        readingScore: 0,
        mathScore: 0,
        behavior: false,
        sped: false,
      },
      {
        id: 's3',
        name: 'Casey',
        gender: 'M',
        readingScore: 0,
        mathScore: 0,
        behavior: false,
        sped: false,
      },
      {
        id: 's4',
        name: 'Dana',
        gender: 'U',
        readingScore: 0,
        mathScore: 0,
        behavior: false,
        sped: false,
      },
    ];
    const assignment = { s1: 0, s2: 0, s3: 0, s4: 0 };
    const locked = new Set();
    const constraints = { keepApart: [], keepTogether: [], keepOutOfClass: [] };
    const teachers = [{ name: 'Ms. Smith' }];

    const data = buildPrintReportData(
      students,
      assignment,
      locked,
      constraints.keepApart,
      constraints.keepTogether,
      constraints.keepOutOfClass,
      teachers,
      numericCriteria,
      flagCriteria
    );

    expect(data.classPages[0].mCount).toBe(2);
    expect(data.classPages[0].fCount).toBe(1);
    expect(data.classPages[0].uCount).toBe(1);
  });

  test('buildPrintReportData handles empty class', () => {
    const students = [
      {
        id: 's1',
        name: 'Alice',
        gender: 'F',
        readingScore: 0,
        mathScore: 0,
        behavior: false,
        sped: false,
      },
    ];
    const assignment = { s1: 0 };
    const locked = new Set();
    const constraints = { keepApart: [], keepTogether: [], keepOutOfClass: [] };
    const teachers = [{ name: 'Ms. Smith' }, { name: 'Mr. Jones' }];

    const data = buildPrintReportData(
      students,
      assignment,
      locked,
      constraints.keepApart,
      constraints.keepTogether,
      constraints.keepOutOfClass,
      teachers,
      numericCriteria,
      flagCriteria
    );

    expect(data.classPages[0].studentCount).toBe(1);
    expect(data.classPages[1].studentCount).toBe(0);
    expect(data.classPages[1].studentRows).toHaveLength(0);
    expect(data.classPages[1].mCount).toBe(0);
    expect(data.classPages[1].fCount).toBe(0);
    expect(data.classPages[1].uCount).toBe(0);
  });

  test('generateColor returns consistent colors for same key+index', () => {
    const c1 = generateColor('behavior', 0);
    const c2 = generateColor('behavior', 0);
    expect(c1).toEqual(c2);
    expect(c1.dot).toBeTruthy();
    expect(c1.bg).toBeTruthy();
    expect(c1.fg).toBeTruthy();
  });

  test('generateColor returns different colors for different indices', () => {
    const c1 = generateColor('behavior', 0);
    const c2 = generateColor('sped', 1);
    // With the 12-slot palette, indices 0 and 1 should be different hues
    expect(c1.dot).not.toBe(c2.dot);
  });
});
