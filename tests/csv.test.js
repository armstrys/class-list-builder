import { describe, test, expect } from 'vitest';
import {
  generateCSVHeaders,
  parseCSVLine,
  parseCSV,
  exportStudentsToCSV,
  exportClassListsToCSV,
  escapeCSVValue,
} from '../src/csv.js';

const numericCriteria = [
  { key: 'readingScore', label: 'Reading Score', weight: 1.0 },
  { key: 'mathScore', label: 'Math Score', weight: 1.0 },
];

const flagCriteria = [
  { key: 'behavior', label: 'Behavior', weight: 2.0 },
  { key: 'sped', label: 'SPED', weight: 2.0 },
];

describe('CSV', () => {
  describe('escapeCSVValue', () => {
    test('returns plain string for values without special characters', () => {
      expect(escapeCSVValue('Alice')).toBe('Alice');
      expect(escapeCSVValue(123)).toBe('123');
      expect(escapeCSVValue(null)).toBe('');
      expect(escapeCSVValue(undefined)).toBe('');
    });

    test('wraps values containing commas in quotes', () => {
      expect(escapeCSVValue('Doe, Alice')).toBe('"Doe, Alice"');
    });

    test('wraps values containing quotes in quotes and doubles the quotes', () => {
      // Values without special characters remain unchanged
      expect(escapeCSVValue('OBrien Jr')).toBe('OBrien Jr');
      // Double quotes need escaping
      expect(escapeCSVValue('Student "The Best"')).toBe('"Student ""The Best"""');
      // Name with comma gets quoted (comma triggers it)
      expect(escapeCSVValue('OBrien, Jr')).toBe('"OBrien, Jr"');
    });

    test('wraps values containing newlines in quotes', () => {
      expect(escapeCSVValue('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
      expect(escapeCSVValue('Line 1\r\nLine 2')).toBe('"Line 1\r\nLine 2"');
    });

    test('handles complex combinations', () => {
      expect(escapeCSVValue('O\'Brien, Jr. "Nick"')).toBe('"O\'Brien, Jr. ""Nick"""');
    });
  });

  describe('generateCSVHeaders', () => {
    test('generates correct headers with default criteria', () => {
      // Act
      const headers = generateCSVHeaders(numericCriteria, flagCriteria);

      // Assert
      expect(headers).toEqual([
        'name',
        'gender',
        'Reading Score',
        'Math Score',
        'Behavior',
        'SPED',
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
        { key: 'zScore', label: 'Z Score', weight: 1.0 },
        { key: 'aScore', label: 'A Score', weight: 1.0 },
      ];

      // Act
      const headers = generateCSVHeaders(customNumeric, []);

      // Assert
      expect(headers).toEqual(['name', 'gender', 'Z Score', 'A Score']);
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
      const fields = parseCSVLine('"John ""Johnny"" Doe",F,85,90,true,false');

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
      const csv = `name,gender,Reading Score,Math Score,Behavior,SPED
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

    test('handles missing optional columns gracefully with warnings', () => {
      // Arrange - CSV without some criteria columns
      const csv = `name,gender
Alice,F
Bob,M`;

      // Act
      const result = parseCSV(csv, numericCriteria, flagCriteria);

      // Assert
      expect(result.errors).toHaveLength(2);
      expect(result.errors.some(e => e.includes('Reading Score'))).toBe(true);
      expect(result.errors.some(e => e.includes('Math Score'))).toBe(true);
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
      const csv = 'name,gender,Reading Score';

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
      const csv = `gender,Reading Score
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
      const csv = `name,gender,Reading Score,Math Score
Alice,F,85.5,90.7`;

      // Act
      const result = parseCSV(csv, numericCriteria, flagCriteria);

      // Assert
      expect(result.students[0].readingScore).toBe(85.5);
      expect(result.students[0].mathScore).toBe(90.7);
    });

    test('handles invalid numeric values gracefully', () => {
      // Arrange
      const csv = `name,gender,Reading Score
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
      expect(lines[0]).toBe('name,gender,Reading Score,Math Score,Behavior,SPED');
      expect(lines[1]).toBe('Alice,F,85,90,1,0');
      expect(lines[2]).toBe('Bob,M,78,82,0,1');
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
      expect(lines[1]).toBe('Alice,F,0,0,0,0');
    });

    test('exports empty student list with headers only', () => {
      // Arrange
      const students = [];

      // Act
      const csv = exportStudentsToCSV(students, numericCriteria, flagCriteria);

      // Assert
      const lines = csv.split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('name,gender,Reading Score,Math Score,Behavior,SPED');
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
      expect(lines[0]).toBe('class,id,name,gender,Reading Score,Math Score,Behavior,SPED');
      expect(lines[1]).toContain('Mrs. Smith');
      expect(lines[1]).toContain('1'); // ID
      expect(lines[1]).toContain('Alice');
      expect(lines[2]).toContain('Mr. Jones');
      expect(lines[2]).toContain('2'); // ID
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
      const csv = exportClassListsToCSV(students, assignment, teachers, [{ key: 'readingScore', label: 'Reading Score' }], []);

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
      const csv = exportClassListsToCSV(students, assignment, teachers, [{ key: 'readingScore', label: 'Reading Score' }], []);

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
      const csv = exportClassListsToCSV(students, assignment, teachers, [{ key: 'readingScore', label: 'Reading Score' }], []);

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
      // Arrange - names with commas should be properly quoted
      const students = [
        { id: '1', name: 'Doe, Alice', gender: 'F', readingScore: 85 },
      ];

      // Act
      const csv = exportStudentsToCSV(students, [{ key: 'readingScore', label: 'Reading Score' }], []);
      const result = parseCSV(csv, [{ key: 'readingScore', label: 'Reading Score' }], []);

      // Assert - the name is properly escaped and parsed
      expect(result.students[0].name).toBe('Doe, Alice');
    });

    test('round-trip preserves student data', () => {
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
      // Constraints are no longer exported/imported via CSV; parseCSV does
      // not return constraint fields at all.
      expect(result.keepApart).toBeUndefined();
      expect(result.keepTogether).toBeUndefined();
      expect(result.keepOutOfClass).toBeUndefined();
    });
  });

  describe('Unrecognized columns', () => {
    test('warns about unrecognized columns including old constraint columns', () => {
      // Arrange
      const csv = `name,gender,Reading Score,keep_apart_group,keep_together_group,notes
Alice,F,85,1,1,some note
Bob,M,78,1,1,another note`;

      // Act
      const result = parseCSV(csv, [{ key: 'readingScore', label: 'Reading Score' }], []);

      // Assert
      expect(result.students).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('keep_apart_group');
      expect(result.errors[0]).toContain('keep_together_group');
      expect(result.errors[0]).toContain('notes');
    });
  });
});
