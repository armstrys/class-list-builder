import { describe, test, expect } from 'vitest';
import {
  generateCSVHeaders,
  parseCSVLine,
  parseCSV,
  exportStudentsToCSV,
  exportClassListsToCSV,
} from '../src/csv.js';

const numericCriteria = [
  { key: 'readingScore', label: 'Reading Score', short: 'Read', weight: 1.0 },
  { key: 'mathScore', label: 'Math Score', short: 'Math', weight: 1.0 },
];

const flagCriteria = [
  { key: 'behavior', label: 'Behavior', short: 'BEH', weight: 2.0 },
  { key: 'sped', label: 'SPED', short: 'SPED', weight: 2.0 },
];

describe('CSV', () => {
  describe('generateCSVHeaders', () => {
    test('generates correct headers with default criteria', () => {
      // Act
      const headers = generateCSVHeaders(numericCriteria, flagCriteria);

      // Assert
      expect(headers).toEqual([
        'name',
        'gender',
        'readingScore',
        'mathScore',
        'behavior',
        'sped',
      ]);
    });

    test('handles empty criteria arrays', () => {
      // Act
      const headers = generateCSVHeaders([], []);

      // Assert
      expect(headers).toEqual(['name', 'gender']);
    });

    test('preserves criteria order', () => {
      // Arrange
      const customNumeric = [
        { key: 'zScore', label: 'Z Score', short: 'Z', weight: 1.0 },
        { key: 'aScore', label: 'A Score', short: 'A', weight: 1.0 },
      ];

      // Act
      const headers = generateCSVHeaders(customNumeric, []);

      // Assert
      expect(headers).toEqual(['name', 'gender', 'zScore', 'aScore']);
    });
  });

  describe('parseCSVLine', () => {
    test('parses simple CSV line', () => {
      // Act
      const fields = parseCSVLine('John Doe,F,85,90,true,false');

      // Assert
      expect(fields).toEqual(['John Doe', 'F', '85', '90', 'true', 'false']);
    });

    test('parses line with quoted fields', () => {
      // Act
      const fields = parseCSVLine('"Doe, John",F,85,90,true,false');

      // Assert
      expect(fields).toEqual(['Doe, John', 'F', '85', '90', 'true', 'false']);
    });

    test('parses line with escaped quotes', () => {
      // Act
      const fields = parseCSVLine('"John ""Johnny\"" Doe",F,85,90,true,false');

      // Assert
      expect(fields).toEqual(['John "Johnny" Doe', 'F', '85', '90', 'true', 'false']);
    });

    test('handles empty fields', () => {
      // Act
      const fields = parseCSVLine('John,,85,,true,');

      // Assert
      expect(fields).toEqual(['John', '', '85', '', 'true', '']);
    });

    test('trims whitespace from fields', () => {
      // Act
      const fields = parseCSVLine('  John Doe  ,  F  ,  85  ');

      // Assert
      expect(fields).toEqual(['John Doe', 'F', '85']);
    });

    test('handles RFC 4180 edge cases', () => {
      // Test with commas, quotes, and newlines within quoted fields
      const fields = parseCSVLine('"Line 1\nLine 2",F,85');

      // Assert
      expect(fields[0]).toBe('Line 1\nLine 2');
    });
  });

  describe('parseCSV', () => {
    test('parses valid CSV with headers', () => {
      // Arrange
      const csv = `name,gender,readingScore,mathScore,behavior,sped
Alice,F,85,90,true,false
Bob,M,78,82,false,true`;

      // Act
      const result = parseCSV(csv, numericCriteria, flagCriteria);

      // Assert
      expect(result.errors).toHaveLength(0);
      expect(result.students).toHaveLength(2);
      expect(result.students[0].name).toBe('Alice');
      expect(result.students[0].gender).toBe('F');
      expect(result.students[0].readingScore).toBe(85);
      expect(result.students[0].behavior).toBe(true);
      expect(result.students[0].sped).toBe(false);
    });

    test('handles missing optional columns gracefully', () => {
      // Arrange - CSV without some criteria columns
      const csv = `name,gender
Alice,F
Bob,M`;

      // Act
      const result = parseCSV(csv, numericCriteria, flagCriteria);

      // Assert
      expect(result.errors).toHaveLength(0);
      expect(result.students).toHaveLength(2);
      expect(result.students[0].readingScore).toBe(0);
      expect(result.students[0].behavior).toBe(false);
    });

    test('returns error for empty CSV', () => {
      // Arrange
      const csv = '';

      // Act
      const result = parseCSV(csv, numericCriteria, flagCriteria);

      // Assert
      expect(result.errors).toContain('No data rows found');
    });

    test('returns error for CSV with only header', () => {
      // Arrange
      const csv = 'name,gender,readingScore';

      // Act
      const result = parseCSV(csv, numericCriteria, flagCriteria);

      // Assert
      expect(result.errors).toContain('No data rows found');
    });

    test('handles CRLF line endings', () => {
      // Arrange
      const csv = 'name,gender\r\nAlice,F\r\nBob,M';

      // Act
      const result = parseCSV(csv, numericCriteria, flagCriteria);

      // Assert
      expect(result.students).toHaveLength(2);
      expect(result.students[0].name).toBe('Alice');
      expect(result.students[1].name).toBe('Bob');
    });

    test('handles CR line endings', () => {
      // Arrange
      const csv = 'name,gender\rAlice,F\rBob,M';

      // Act
      const result = parseCSV(csv, numericCriteria, flagCriteria);

      // Assert
      expect(result.students).toHaveLength(2);
    });

    test('parses boolean flags case-insensitively', () => {
      // Arrange
      const csv = `name,gender,behavior,sped
Alice,F,TRUE,YES
Bob,M,true,y
Charlie,F,1,X
Dave,M,FALSE,no`;

      // Act
      const result = parseCSV(csv, numericCriteria, flagCriteria);

      // Assert
      expect(result.students[0].behavior).toBe(true);
      expect(result.students[0].sped).toBe(true);
      expect(result.students[1].behavior).toBe(true);
      expect(result.students[1].sped).toBe(true);
      expect(result.students[2].behavior).toBe(true);
      expect(result.students[2].sped).toBe(true);
      expect(result.students[3].behavior).toBe(false);
      expect(result.students[3].sped).toBe(false);
    });

    test('generates default names when name column missing', () => {
      // Arrange
      const csv = `gender,readingScore
F,85
M,78`;

      // Act
      const result = parseCSV(csv, numericCriteria, flagCriteria);

      // Assert
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.students[0].name).toBe('Student 2');
      expect(result.students[1].name).toBe('Student 3');
    });

    test('assigns unknown gender as U', () => {
      // Arrange
      const csv = `name,gender
Alice,Unknown
Bob,`;

      // Act
      const result = parseCSV(csv, numericCriteria, flagCriteria);

      // Assert
      expect(result.students[0].gender).toBe('U');
      expect(result.students[1].gender).toBe('U');
    });

    test('recognizes gender column variations', () => {
      // Arrange
      const csv = `name,sex
Alice,Female
Bob,Male`;

      // Act
      const result = parseCSV(csv, numericCriteria, flagCriteria);

      // Assert
      expect(result.students[0].gender).toBe('F');
      expect(result.students[1].gender).toBe('M');
    });

    test('recognizes name column variations', () => {
      // Arrange
      const csv = `student,gender
Alice,F
Bob,M`;

      // Act
      const result = parseCSV(csv, numericCriteria, flagCriteria);

      // Assert
      expect(result.students[0].name).toBe('Alice');
    });

    test('parses numeric scores with decimals', () => {
      // Arrange
      const csv = `name,gender,readingScore,mathScore
Alice,F,85.5,90.7`;

      // Act
      const result = parseCSV(csv, numericCriteria, flagCriteria);

      // Assert
      expect(result.students[0].readingScore).toBe(85.5);
      expect(result.students[0].mathScore).toBe(90.7);
    });

    test('handles invalid numeric values gracefully', () => {
      // Arrange
      const csv = `name,gender,readingScore
Alice,F,invalid
Bob,F,`;

      // Act
      const result = parseCSV(csv, numericCriteria, flagCriteria);

      // Assert
      expect(result.students[0].readingScore).toBe(0);
      expect(result.students[1].readingScore).toBe(0);
    });
  });

  describe('exportStudentsToCSV', () => {
    test('exports students to CSV correctly', () => {
      // Arrange
      const students = [
        { id: '1', name: 'Alice', gender: 'F', readingScore: 85, mathScore: 90, behavior: true, sped: false },
        { id: '2', name: 'Bob', gender: 'M', readingScore: 78, mathScore: 82, behavior: false, sped: true },
      ];

      // Act
      const csv = exportStudentsToCSV(students, numericCriteria, flagCriteria);

      // Assert
      const lines = csv.split('\n');
      expect(lines[0]).toBe('name,gender,readingScore,mathScore,behavior,sped,keep_apart_group,keep_together_group');
      expect(lines[1]).toBe('Alice,F,85,90,1,0,,');
      expect(lines[2]).toBe('Bob,M,78,82,0,1,,');
    });

    test('handles students with missing fields', () => {
      // Arrange
      const students = [
        { id: '1', name: 'Alice', gender: 'F' }, // missing numeric and flag fields
      ];

      // Act
      const csv = exportStudentsToCSV(students, numericCriteria, flagCriteria);

      // Assert
      const lines = csv.split('\n');
      expect(lines[1]).toBe('Alice,F,0,0,0,0,,');
    });

    test('exports empty student list with headers only', () => {
      // Arrange
      const students = [];

      // Act
      const csv = exportStudentsToCSV(students, numericCriteria, flagCriteria);

      // Assert
      const lines = csv.split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('name,gender,readingScore,mathScore,behavior,sped,keep_apart_group,keep_together_group');
    });

    test('exports keep apart groups to CSV', () => {
      // Arrange
      const students = [
        { id: 's1', name: 'Alice', gender: 'F', readingScore: 85, mathScore: 90, behavior: false, sped: false },
        { id: 's2', name: 'Bob', gender: 'M', readingScore: 78, mathScore: 82, behavior: false, sped: false },
        { id: 's3', name: 'Charlie', gender: 'M', readingScore: 70, mathScore: 75, behavior: false, sped: false },
      ];
      const keepApart = [['s1', 's2'], ['s2', 's3']]; // s1, s2, s3 should all be in same group

      // Act
      const csv = exportStudentsToCSV(students, numericCriteria, flagCriteria, keepApart);

      // Assert
      const lines = csv.split('\n');
      expect(lines[0]).toBe('name,gender,readingScore,mathScore,behavior,sped,keep_apart_group,keep_together_group');
      // All three should have group 1
      expect(lines[1]).toBe('Alice,F,85,90,0,0,1,');
      expect(lines[2]).toBe('Bob,M,78,82,0,0,1,');
      expect(lines[3]).toBe('Charlie,M,70,75,0,0,1,');
    });

    test('exports multiple keep apart groups', () => {
      // Arrange
      const students = [
        { id: 's1', name: 'Alice', gender: 'F', readingScore: 85, mathScore: 90, behavior: false, sped: false },
        { id: 's2', name: 'Bob', gender: 'M', readingScore: 78, mathScore: 82, behavior: false, sped: false },
        { id: 's3', name: 'Charlie', gender: 'M', readingScore: 70, mathScore: 75, behavior: false, sped: false },
        { id: 's4', name: 'Diana', gender: 'F', readingScore: 92, mathScore: 88, behavior: false, sped: false },
      ];
      const keepApart = [['s1', 's2'], ['s3', 's4']]; // Two separate groups

      // Act
      const csv = exportStudentsToCSV(students, numericCriteria, flagCriteria, keepApart);

      // Assert
      const lines = csv.split('\n');
      expect(lines[1]).toBe('Alice,F,85,90,0,0,1,');
      expect(lines[2]).toBe('Bob,M,78,82,0,0,1,');
      expect(lines[3]).toBe('Charlie,M,70,75,0,0,2,');
      expect(lines[4]).toBe('Diana,F,92,88,0,0,2,');
    });
  });

  describe('exportClassListsToCSV', () => {
    test('exports class assignments to CSV', () => {
      // Arrange
      const students = [
        { id: '1', name: 'Alice', gender: 'F', readingScore: 85, mathScore: 90, behavior: false, sped: false },
        { id: '2', name: 'Bob', gender: 'M', readingScore: 78, mathScore: 82, behavior: false, sped: false },
      ];
      const assignment = { '1': 0, '2': 1 };
      const teachers = [{ name: 'Mrs. Smith' }, { name: 'Mr. Jones' }];

      // Act
      const csv = exportClassListsToCSV(students, assignment, teachers, numericCriteria, flagCriteria);

      // Assert
      const lines = csv.split('\n');
      expect(lines[0]).toBe('class,name,gender,readingScore,mathScore,behavior,sped');
      expect(lines[1]).toContain('Mrs. Smith');
      expect(lines[1]).toContain('Alice');
      expect(lines[2]).toContain('Mr. Jones');
      expect(lines[2]).toContain('Bob');
    });

    test('sorts by class then by name', () => {
      // Arrange
      const students = [
        { id: '1', name: 'Charlie', gender: 'M', readingScore: 80 },
        { id: '2', name: 'Alice', gender: 'F', readingScore: 85 },
        { id: '3', name: 'Bob', gender: 'M', readingScore: 82 },
      ];
      const assignment = { '1': 0, '2': 0, '3': 0 }; // All in same class
      const teachers = [{ name: 'Teacher' }];

      // Act
      const csv = exportClassListsToCSV(students, assignment, teachers, [{ key: 'readingScore' }], []);

      // Assert
      const lines = csv.split('\n');
      // Should be sorted: Alice, Bob, Charlie
      expect(lines[1]).toContain('Alice');
      expect(lines[2]).toContain('Bob');
      expect(lines[3]).toContain('Charlie');
    });

    test('uses class index when teacher name missing', () => {
      // Arrange
      const students = [
        { id: '1', name: 'Alice', gender: 'F', readingScore: 85 },
      ];
      const assignment = { '1': 1 }; // Class index 1
      const teachers = [{ name: 'Class 0' }]; // Only one teacher defined

      // Act
      const csv = exportClassListsToCSV(students, assignment, teachers, [{ key: 'readingScore' }], []);

      // Assert
      const lines = csv.split('\n');
      expect(lines[1]).toContain('Class 2'); // Should use "Class {index+1}"
    });

    test('excludes unassigned students', () => {
      // Arrange
      const students = [
        { id: '1', name: 'Alice', gender: 'F', readingScore: 85 },
        { id: '2', name: 'Bob', gender: 'M', readingScore: 82 },
      ];
      const assignment = { '1': 0 }; // Bob not assigned
      const teachers = [{ name: 'Teacher' }];

      // Act
      const csv = exportClassListsToCSV(students, assignment, teachers, [{ key: 'readingScore' }], []);

      // Assert
      expect(csv).toContain('Alice');
      expect(csv).not.toContain('Bob');
    });
  });

  describe('Round-trip tests', () => {
    test('export then import preserves data', () => {
      // Arrange
      const students = [
        { id: '1', name: 'Alice', gender: 'F', readingScore: 85, mathScore: 90, behavior: true, sped: false },
        { id: '2', name: 'Bob', gender: 'M', readingScore: 78, mathScore: 82, behavior: false, sped: true },
      ];

      // Act
      const csv = exportStudentsToCSV(students, numericCriteria, flagCriteria);
      const result = parseCSV(csv, numericCriteria, flagCriteria);

      // Assert
      expect(result.students).toHaveLength(2);
      expect(result.students[0].name).toBe('Alice');
      expect(result.students[0].gender).toBe('F');
      expect(result.students[0].readingScore).toBe(85);
      expect(result.students[0].behavior).toBe(true);
      expect(result.students[1].name).toBe('Bob');
      expect(result.students[1].sped).toBe(true);
    });

    test('handles names with commas in round-trip', () => {
      // Arrange - Note: export doesn't quote names, so commas will break
      // This test documents current behavior
      const students = [
        { id: '1', name: 'Doe, Alice', gender: 'F', readingScore: 85 },
      ];

      // Act
      const csv = exportStudentsToCSV(students, [{ key: 'readingScore' }], []);
      const result = parseCSV(csv, [{ key: 'readingScore' }], []);

      // Assert - the name is parsed as two fields (current behavior limitation)
      expect(result.students[0].name).not.toBe('Doe, Alice');
    });

    test('round-trip preserves keep apart groups', () => {
      // Arrange
      const students = [
        { id: 's1', name: 'Alice', gender: 'F', readingScore: 85 },
        { id: 's2', name: 'Bob', gender: 'M', readingScore: 78 },
        { id: 's3', name: 'Charlie', gender: 'M', readingScore: 70 },
      ];
      const keepApart = [['s1', 's2']]; // Alice and Bob should be kept apart

      // Act - export then parse
      const csv = exportStudentsToCSV(students, [{ key: 'readingScore' }], [], keepApart);
      const result = parseCSV(csv, [{ key: 'readingScore' }], []);

      // Assert - keepApart pairs are reconstructed from groups
      expect(result.students).toHaveLength(3);
      expect(result.keepApart).toHaveLength(1);
      // The reconstructed pair should contain Alice and Bob's new IDs
      const studentNames = result.students.reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {});
      const pairNames = result.keepApart.map(pair => [studentNames[pair[0]], studentNames[pair[1]]].sort());
      expect(pairNames).toContainEqual(['Alice', 'Bob']);
    });
  });

  describe('keep_apart_group parsing', () => {
    test('parses keep_apart_group column', () => {
      // Arrange
      const csv = `name,gender,readingScore,keep_apart_group
Alice,F,85,1
Bob,M,78,1
Charlie,M,70,2
Diana,F,92,2`;

      // Act
      const result = parseCSV(csv, [{ key: 'readingScore' }], []);

      // Assert
      expect(result.students).toHaveLength(4);
      expect(result.keepApart).toHaveLength(2); // C(4,2) pairs: 2 pairs within each group
      // Should create pairs: (Alice,Bob) and (Charlie,Diana)
      const studentIds = result.students.map(s => s.id);
      expect(result.keepApart).toContainEqual([studentIds[0], studentIds[1]]);
      expect(result.keepApart).toContainEqual([studentIds[2], studentIds[3]]);
    });

    test('parses keepapartgroup (no underscore) column', () => {
      // Arrange
      const csv = `name,gender,readingScore,keepapartgroup
Alice,F,85,groupA
Bob,M,78,groupA`;

      // Act
      const result = parseCSV(csv, [{ key: 'readingScore' }], []);

      // Assert
      expect(result.students).toHaveLength(2);
      expect(result.keepApart).toHaveLength(1);
    });

    test('handles empty keep_apart_group values', () => {
      // Arrange
      const csv = `name,gender,readingScore,keep_apart_group
Alice,F,85,
Bob,M,78,1
Charlie,M,70,`;

      // Act
      const result = parseCSV(csv, [{ key: 'readingScore' }], []);

      // Assert
      expect(result.students).toHaveLength(3);
      expect(result.keepApart).toHaveLength(0); // Only one student in group 1
    });

    test('handles missing keep_apart_group column', () => {
      // Arrange
      const csv = `name,gender,readingScore
Alice,F,85
Bob,M,78`;

      // Act
      const result = parseCSV(csv, [{ key: 'readingScore' }], []);

      // Assert
      expect(result.students).toHaveLength(2);
      expect(result.keepApart).toEqual([]);
    });

    test('creates all pairs within a group of 3', () => {
      // Arrange - group of 3 should create C(3,2) = 3 pairs
      const csv = `name,gender,readingScore,keep_apart_group
Alice,F,85,1
Bob,M,78,1
Charlie,M,70,1`;

      // Act
      const result = parseCSV(csv, [{ key: 'readingScore' }], []);

      // Assert
      expect(result.keepApart).toHaveLength(3);
    });
  });

  describe('keep_together_group parsing', () => {
    test('parses keep_together_group column', () => {
      // Arrange
      const csv = `name,gender,readingScore,keep_together_group
Alice,F,85,1
Bob,M,78,1
Charlie,M,70,2
Diana,F,92,2`;

      // Act
      const result = parseCSV(csv, [{ key: 'readingScore' }], []);

      // Assert
      expect(result.students).toHaveLength(4);
      expect(result.keepTogether).toHaveLength(2); // Two groups
      // Should create groups: [Alice, Bob] and [Charlie, Diana]
      const studentIds = result.students.map(s => s.id);
      expect(result.keepTogether).toContainEqual([studentIds[0], studentIds[1]]);
      expect(result.keepTogether).toContainEqual([studentIds[2], studentIds[3]]);
    });

    test('parses keeptogethergroup (no underscore) column', () => {
      // Arrange
      const csv = `name,gender,readingScore,keeptogethergroup
Alice,F,85,groupA
Bob,M,78,groupA`;

      // Act
      const result = parseCSV(csv, [{ key: 'readingScore' }], []);

      // Assert
      expect(result.students).toHaveLength(2);
      expect(result.keepTogether).toHaveLength(1);
    });

    test('handles empty keep_together_group values', () => {
      // Arrange
      const csv = `name,gender,readingScore,keep_together_group
Alice,F,85,
Bob,M,78,1
Charlie,M,70,`;

      // Act
      const result = parseCSV(csv, [{ key: 'readingScore' }], []);

      // Assert
      expect(result.students).toHaveLength(3);
      expect(result.keepTogether).toHaveLength(0); // Only one student in group 1
    });

    test('handles missing keep_together_group column', () => {
      // Arrange
      const csv = `name,gender,readingScore
Alice,F,85
Bob,M,78`;

      // Act
      const result = parseCSV(csv, [{ key: 'readingScore' }], []);

      // Assert
      expect(result.students).toHaveLength(2);
      expect(result.keepTogether).toEqual([]);
    });

    test('creates groups of size 3 correctly', () => {
      // Arrange - group of 3
      const csv = `name,gender,readingScore,keep_together_group
Alice,F,85,1
Bob,M,78,1
Charlie,M,70,1`;

      // Act
      const result = parseCSV(csv, [{ key: 'readingScore' }], []);

      // Assert
      expect(result.keepTogether).toHaveLength(1);
      expect(result.keepTogether[0]).toHaveLength(3);
    });
  });

  describe('keep_together_group export', () => {
    test('exports keep together groups to CSV', () => {
      // Arrange
      const students = [
        { id: 's1', name: 'Alice', gender: 'F', readingScore: 85, mathScore: 90, behavior: false, sped: false },
        { id: 's2', name: 'Bob', gender: 'M', readingScore: 78, mathScore: 82, behavior: false, sped: false },
        { id: 's3', name: 'Charlie', gender: 'M', readingScore: 70, mathScore: 75, behavior: false, sped: false },
      ];
      const keepTogether = [['s1', 's2']]; // Alice and Bob should be kept together

      // Act
      const csv = exportStudentsToCSV(students, numericCriteria, flagCriteria, [], keepTogether);

      // Assert
      const lines = csv.split('\n');
      expect(lines[0]).toBe('name,gender,readingScore,mathScore,behavior,sped,keep_apart_group,keep_together_group');
      // Alice and Bob should have group 1, Charlie should have no group
      expect(lines[1]).toBe('Alice,F,85,90,0,0,,1');
      expect(lines[2]).toBe('Bob,M,78,82,0,0,,1');
      expect(lines[3]).toBe('Charlie,M,70,75,0,0,,');
    });

    test('exports multiple keep together groups', () => {
      // Arrange
      const students = [
        { id: 's1', name: 'Alice', gender: 'F', readingScore: 85, mathScore: 90, behavior: false, sped: false },
        { id: 's2', name: 'Bob', gender: 'M', readingScore: 78, mathScore: 82, behavior: false, sped: false },
        { id: 's3', name: 'Charlie', gender: 'M', readingScore: 70, mathScore: 75, behavior: false, sped: false },
        { id: 's4', name: 'Diana', gender: 'F', readingScore: 92, mathScore: 88, behavior: false, sped: false },
      ];
      const keepTogether = [['s1', 's2'], ['s3', 's4']]; // Two separate groups

      // Act
      const csv = exportStudentsToCSV(students, numericCriteria, flagCriteria, [], keepTogether);

      // Assert
      const lines = csv.split('\n');
      expect(lines[1]).toBe('Alice,F,85,90,0,0,,1');
      expect(lines[2]).toBe('Bob,M,78,82,0,0,,1');
      expect(lines[3]).toBe('Charlie,M,70,75,0,0,,2');
      expect(lines[4]).toBe('Diana,F,92,88,0,0,,2');
    });
  });

  describe('Combined constraints round-trip', () => {
    test('round-trip preserves both constraint types', () => {
      // Arrange
      const students = [
        { id: 's1', name: 'Alice', gender: 'F', readingScore: 85 },
        { id: 's2', name: 'Bob', gender: 'M', readingScore: 78 },
        { id: 's3', name: 'Charlie', gender: 'M', readingScore: 70 },
        { id: 's4', name: 'Diana', gender: 'F', readingScore: 92 },
      ];
      const keepApart = [['s1', 's3']]; // Alice and Charlie apart
      const keepTogether = [['s1', 's2']]; // Alice and Bob together

      // Act - export then parse
      const csv = exportStudentsToCSV(students, [{ key: 'readingScore' }], [], keepApart, keepTogether);
      const result = parseCSV(csv, [{ key: 'readingScore' }], []);

      // Assert - students reconstructed
      expect(result.students).toHaveLength(4);

      // Check keepApart - Alice and Charlie should be apart
      const studentNames = result.students.reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {});
      const apartNames = result.keepApart.map(pair => [studentNames[pair[0]], studentNames[pair[1]]].sort());
      expect(apartNames).toContainEqual(['Alice', 'Charlie']);

      // Check keepTogether - Alice and Bob should be together
      const togetherNames = result.keepTogether.map(group => group.map(id => studentNames[id]).sort());
      expect(togetherNames).toContainEqual(['Alice', 'Bob']);
    });
  });
});
