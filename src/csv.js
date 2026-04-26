function generateCSVHeaders(numericCriteria, flagCriteria) {
  const numHeaders = numericCriteria.map(c => c.key);
  const boolHeaders = flagCriteria.map(c => c.key);
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

function parseCSV(text, numericCriteria, flagCriteria) {
  // Normalize CRLF and bare CR to LF
  const normalized = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length < 2) return { students: [], errors: ['No data rows found'] };

  // Normalize headers: lowercase, strip spaces
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ''));

  const students = [];
  const errors = [];

  // Build mapping from criteria keys to CSV column indices
  const numericKeyMap = {};
  const flagKeyMap = {};

  numericCriteria.forEach(({ key }) => {
    const idx = headers.findIndex(h => h === key.toLowerCase());
    if (idx !== -1) numericKeyMap[key] = idx;
  });

  flagCriteria.forEach(({ key }) => {
    const idx = headers.findIndex(h => h === key.toLowerCase());
    if (idx !== -1) flagKeyMap[key] = idx;
  });

  // Find name and gender columns
  const nameIdx = headers.findIndex(h => ['name','student','lastnamefirstname'].includes(h));
  const genderIdx = headers.findIndex(h => ['gender','sex'].includes(h));

  if (nameIdx === -1) errors.push('Could not find a name column (expected: name, student)');
  if (genderIdx === -1) errors.push('Could not find a gender column (expected: gender, sex)');

  lines.slice(1).forEach((line, i) => {
    if (!line.trim()) return;
    const cols = parseCSVLine(line);

    const name = nameIdx !== -1 ? (cols[nameIdx] || `Student ${i + 2}`) : `Student ${i + 2}`;
    const genderVal = genderIdx !== -1 ? (cols[genderIdx] || '').toUpperCase() : '';
    const gender = genderVal.startsWith('F') ? 'F' : genderVal.startsWith('M') ? 'M' : 'U';

    const student = { id: uid(), name, gender };

    numericCriteria.forEach(({ key }) => {
      const idx = numericKeyMap[key];
      student[key] = idx !== undefined ? (parseFloat(cols[idx]) || 0) : 0;
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

    students.push(student);
  });

  return { students, errors };
}

function exportStudentsToCSV(students, numericCriteria, flagCriteria) {
  const headers = ['name', 'gender', ...numericCriteria.map(c => c.key), ...flagCriteria.map(c => c.key)];
  const lines = [headers.join(',')];

  students.forEach(s => {
    const values = [s.name, s.gender];
    numericCriteria.forEach(({ key }) => values.push(s[key] || 0));
    flagCriteria.forEach(({ key }) => values.push(s[key] ? 1 : 0));
    lines.push(values.join(','));
  });

  return lines.join('\n');
}

function exportClassListsToCSV(students, assignment, teachers, numericCriteria, flagCriteria) {
  const headers = ['class', 'name', 'gender', ...numericCriteria.map(c => c.key), ...flagCriteria.map(c => c.key)];
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
    const values = [className, s.name, s.gender];
    numericCriteria.forEach(({ key }) => values.push(s[key] || 0));
    flagCriteria.forEach(({ key }) => values.push(s[key] ? 1 : 0));
    lines.push(values.join(','));
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
