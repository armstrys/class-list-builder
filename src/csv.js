// uid generator for Node.js testing (falls back to this if uid not already defined)
function _uid() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Escape CSV field value per RFC 4180
// Fields containing commas, quotes, or newlines must be quoted
// Quotes inside quoted fields are escaped by doubling them
function escapeCSVValue(value) {
  const str = String(value ?? '');
  // Check if escaping is needed: comma, double quote, carriage return, or newline
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSVHeaders(numericCriteria, flagCriteria) {
  const numHeaders = numericCriteria.map(c => c.label);
  const boolHeaders = flagCriteria.map(c => c.label);
  return ['name', 'gender', ...numHeaders, ...boolHeaders];
}

// Parse a single CSV line respecting RFC 4180 quoted fields
function parseCSVLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; }  // escaped quote
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(field.trim()); field = ''; }
      else { field += ch; }
    }
  }
  fields.push(field.trim());
  return fields;
}

function parseStudentRow(cols, i, ctx, errors) {
  const { nameIdx, genderIdx, idIdx, numericKeyMap, flagKeyMap, numericCriteria, flagCriteria } = ctx;
  const name = nameIdx !== -1 ? (cols[nameIdx] || `Student ${i + 2}`) : `Student ${i + 2}`;
  const genderVal = genderIdx !== -1 ? (cols[genderIdx] || '').toUpperCase() : '';
  const gender = genderVal.startsWith('F') ? 'F' : genderVal.startsWith('M') ? 'M' : 'U';

  let studentId;
  if (idIdx !== -1 && cols[idIdx]?.trim()) {
    studentId = cols[idIdx].trim();
  } else {
    const generateId = typeof uid !== 'undefined' ? uid : _uid;
    studentId = generateId();
  }
  const student = { id: studentId, name, gender };

  numericCriteria.forEach(({ key }) => {
    const idx = numericKeyMap[key];
    if (idx !== undefined) {
      const rawValue = cols[idx];
      if (rawValue === undefined || rawValue.trim() === '') {
        student[key] = 0;
      } else {
        const parsed = parseFloat(rawValue);
        if (isNaN(parsed)) {
          errors.push(`Row ${i + 2}: Invalid ${key} value "${rawValue}" for student "${name}"`);
          student[key] = 0;
        } else {
          student[key] = parsed;
        }
      }
    } else {
      student[key] = 0;
    }
  });

  flagCriteria.forEach(({ key }) => {
    const idx = flagKeyMap[key];
    if (idx !== undefined) {
      const v = (cols[idx] || '').toLowerCase();
      student[key] = ['1','true','yes','y','x'].includes(v);
    } else {
      student[key] = false;
    }
  });

  return student;
}

function parseCSV(text, numericCriteria, flagCriteria) {
  // Normalize CRLF and bare CR to LF
  const normalized = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length < 2) return { students: [], errors: ['No data rows found'], keepApart: [], keepTogether: [], keepOutOfClass: [] };

  // Normalize headers: lowercase, strip spaces
  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map(h => h.toLowerCase().replace(/\s+/g, ''));

  const students = [];
  const errors = [];

  // Build mapping from criteria keys to CSV column indices
  const numericKeyMap = {};
  const flagKeyMap = {};

  numericCriteria.forEach(({ key, label }) => {
    const normalizedLabel = label.toLowerCase().replace(/\s+/g, '');
    const idx = headers.findIndex(h => h === normalizedLabel);
    if (idx !== -1) numericKeyMap[key] = idx;
  });

  flagCriteria.forEach(({ key, label }) => {
    const normalizedLabel = label.toLowerCase().replace(/\s+/g, '');
    const idx = headers.findIndex(h => h === normalizedLabel);
    if (idx !== -1) flagKeyMap[key] = idx;
  });

  // Find name, gender, id columns
  const nameIdx = headers.findIndex(h => ['name','student','lastnamefirstname'].includes(h));
  const genderIdx = headers.findIndex(h => ['gender','sex'].includes(h));
  const idIdx = headers.findIndex(h => h === 'id' || h === 'studentid' || h === 'student_id');

  if (nameIdx === -1) errors.push('Could not find a name column (expected: name, student)');
  if (genderIdx === -1) errors.push('Could not find a gender column (expected: gender, sex)');

  // Warn about missing expected columns
  const missingNumeric = numericCriteria.filter(({ key }) => numericKeyMap[key] === undefined);
  const missingFlags = flagCriteria.filter(({ key }) => flagKeyMap[key] === undefined);
  if (missingNumeric.length > 0) {
    errors.push(`Missing columns (will use 0): ${missingNumeric.map(c => c.label).join(', ')}`);
  }
  if (missingFlags.length > 0) {
    errors.push(`Missing columns (will use false): ${missingFlags.map(c => c.label).join(', ')}`);
  }

  // Warn about unrecognized columns
  const expectedHeaders = new Set([
    'name', 'student', 'lastnamefirstname',
    'gender', 'sex',
    'id', 'studentid', 'student_id',
    ...numericCriteria.map(c => c.label.toLowerCase().replace(/\s+/g, '')),
    ...flagCriteria.map(c => c.label.toLowerCase().replace(/\s+/g, ''))
  ]);
  const unrecognized = headers
    .map((h, i) => ({ normalized: h, raw: rawHeaders[i] }))
    .filter(({ normalized }) => normalized && !expectedHeaders.has(normalized));
  if (unrecognized.length > 0) {
    errors.push(`Unrecognized columns (ignored): ${unrecognized.map(({ raw }) => raw).join(', ')}`);
  }

  lines.slice(1).forEach((line, i) => {
    if (!line.trim()) return;
    const cols = parseCSVLine(line);
    const ctx = { nameIdx, genderIdx, idIdx, numericKeyMap, flagKeyMap, numericCriteria, flagCriteria };
    students.push(parseStudentRow(cols, i, ctx, errors));
  });

  return { students, errors, keepApart: [], keepTogether: [], keepOutOfClass: [] };
}

function exportStudentsToCSV(students, numericCriteria, flagCriteria) {
  const headers = ['name', 'gender', ...numericCriteria.map(c => c.label), ...flagCriteria.map(c => c.label)];
  const lines = [headers.join(',')];

  students.forEach(s => {
    const values = [s.name, s.gender];
    numericCriteria.forEach(({ key }) => values.push(s[key] || 0));
    flagCriteria.forEach(({ key }) => values.push(s[key] ? 1 : 0));
    lines.push(values.map(escapeCSVValue).join(','));
  });

  return lines.join('\n');
}

function exportClassListsToCSV(students, assignment, teachers, numericCriteria, flagCriteria) {
  const headers = ['class', 'id', 'name', 'gender', ...numericCriteria.map(c => c.label), ...flagCriteria.map(c => c.label)];
  const lines = [headers.join(',')];

  const sorted = [...students]
    .filter(s => assignment[s.id] !== undefined)
    .sort((a, b) => {
      const ca = assignment[a.id], cb = assignment[b.id];
      if (ca !== cb) return ca - cb;
      return a.name.localeCompare(b.name);
    });

  sorted.forEach(s => {
    const classIdx = assignment[s.id];
    const className = teachers[classIdx]?.name || `Class ${classIdx + 1}`;
    const values = [className, s.id, s.name, s.gender];
    numericCriteria.forEach(({ key }) => values.push(s[key] || 0));
    flagCriteria.forEach(({ key }) => values.push(s[key] ? 1 : 0));
    lines.push(values.map(escapeCSVValue).join(','));
  });

  return lines.join('\n');
}

function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Export for Node.js testing (conditional to not break browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateCSVHeaders,
    parseCSVLine,
    parseCSV,
    exportStudentsToCSV,
    exportClassListsToCSV,
    triggerDownload,
    escapeCSVValue
  };
}
