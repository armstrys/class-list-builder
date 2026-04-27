// uid generator for Node.js testing (falls back to this if uid not already defined)
function _uid() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

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
  if (lines.length < 2) return { students: [], errors: ['No data rows found'], keepApart: [], keepTogether: [], keepOutOfClass: [] };

  // Normalize headers: lowercase, strip spaces
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ''));

  const students = [];
  const errors = [];
  const keepApartGroups = {}; // groupId -> array of student indices
  const keepTogetherGroups = {}; // groupId -> array of student indices
  const keepOutOfClassConstraints = []; // Array<{studentId, classIndex}>

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

  // Find name, gender, and keep constraint columns
  const nameIdx = headers.findIndex(h => ['name','student','lastnamefirstname'].includes(h));
  const genderIdx = headers.findIndex(h => ['gender','sex'].includes(h));
  const keepApartIdx = headers.findIndex(h => h === 'keepapartgroup' || h === 'keep_apart_group');
  const keepTogetherIdx = headers.findIndex(h => h === 'keeptogethergroup' || h === 'keep_together_group');
  const keepOutOfClassIdx = headers.findIndex(h => h === 'keepoutofclass' || h === 'keep_out_of_class');

  if (nameIdx === -1) errors.push('Could not find a name column (expected: name, student)');
  if (genderIdx === -1) errors.push('Could not find a gender column (expected: gender, sex)');

  lines.slice(1).forEach((line, i) => {
    if (!line.trim()) return;
    const cols = parseCSVLine(line);

    const name = nameIdx !== -1 ? (cols[nameIdx] || `Student ${i + 2}`) : `Student ${i + 2}`;
    const genderVal = genderIdx !== -1 ? (cols[genderIdx] || '').toUpperCase() : '';
    const gender = genderVal.startsWith('F') ? 'F' : genderVal.startsWith('M') ? 'M' : 'U';

    // Use global uid if available (browser), otherwise use local _uid (Node.js tests)
    const generateId = typeof uid !== 'undefined' ? uid : _uid;
    const student = { id: generateId(), name, gender };

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

    // Track keep apart groups
    if (keepApartIdx !== -1) {
      const groupId = cols[keepApartIdx]?.trim();
      if (groupId) {
        if (!keepApartGroups[groupId]) keepApartGroups[groupId] = [];
        keepApartGroups[groupId].push(student.id);
      }
    }

    // Track keep together groups
    if (keepTogetherIdx !== -1) {
      const groupId = cols[keepTogetherIdx]?.trim();
      if (groupId) {
        if (!keepTogetherGroups[groupId]) keepTogetherGroups[groupId] = [];
        keepTogetherGroups[groupId].push(student.id);
      }
    }

    // Track keep out of class constraints
    if (keepOutOfClassIdx !== -1) {
      const classIndicesStr = cols[keepOutOfClassIdx]?.trim();
      if (classIndicesStr) {
        // Parse comma-separated class indices (e.g., "0,2" or "1")
        const classIndices = classIndicesStr
          .split(',')
          .map(s => parseInt(s.trim(), 10))
          .filter(n => !isNaN(n) && n >= 0);
        classIndices.forEach(classIndex => {
          keepOutOfClassConstraints.push({ studentId: student.id, classIndex });
        });
      }
    }

    students.push(student);
  });

  // Build keepApart pairs from groups
  const keepApart = [];
  Object.values(keepApartGroups).forEach(group => {
    // Create all pairs within the group
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        keepApart.push([group[i], group[j]]);
      }
    }
  });

  // Build keepTogether groups array
  const keepTogether = Object.values(keepTogetherGroups).filter(group => group.length >= 2);

  // Keep out of class constraints are already in the correct format
  const keepOutOfClass = keepOutOfClassConstraints;

  return { students, errors, keepApart, keepTogether, keepOutOfClass };
}

function exportStudentsToCSV(students, numericCriteria, flagCriteria, keepApart = [], keepTogether = [], keepOutOfClass = []) {
  const headers = ['name', 'gender', ...numericCriteria.map(c => c.key), ...flagCriteria.map(c => c.key), 'keep_apart_group', 'keep_together_group', 'keep_out_of_class'];
  const lines = [headers.join(',')];

  // Build a map of student ID to keep-apart group number
  const studentApartMap = new Map();
  const apartMap = new Map();
  let nextApartNum = 1;
  keepApart.forEach(([id1, id2]) => {
    const group1 = studentApartMap.get(id1);
    const group2 = studentApartMap.get(id2);
    if (group1 && group2 && group1 !== group2) {
      // Merge groups - use the lower number
      const targetGroup = Math.min(group1, group2);
      const sourceGroup = Math.max(group1, group2);
      // Update all students in source group to target group
      apartMap.get(sourceGroup).forEach(id => studentApartMap.set(id, targetGroup));
      apartMap.get(targetGroup).push(...apartMap.get(sourceGroup));
      apartMap.delete(sourceGroup);
    } else if (group1) {
      studentApartMap.set(id2, group1);
      apartMap.get(group1).push(id2);
    } else if (group2) {
      studentApartMap.set(id1, group2);
      apartMap.get(group2).push(id1);
    } else {
      // New group
      studentApartMap.set(id1, nextApartNum);
      studentApartMap.set(id2, nextApartNum);
      apartMap.set(nextApartNum, [id1, id2]);
      nextApartNum++;
    }
  });

  // Build a map of student ID to keep-together group number
  const studentTogetherMap = new Map();
  let nextTogetherNum = 1;
  keepTogether.forEach(group => {
    group.forEach(id => studentTogetherMap.set(id, nextTogetherNum));
    nextTogetherNum++;
  });

  // Build a map of student ID to comma-separated class indices for keep out of class
  const studentOutOfClassMap = new Map();
  keepOutOfClass.forEach(({ studentId, classIndex }) => {
    if (!studentOutOfClassMap.has(studentId)) {
      studentOutOfClassMap.set(studentId, []);
    }
    studentOutOfClassMap.get(studentId).push(classIndex);
  });

  students.forEach(s => {
    const apartNum = studentApartMap.get(s.id);
    const togetherNum = studentTogetherMap.get(s.id);
    const outOfClassList = studentOutOfClassMap.get(s.id);
    const outOfClassStr = outOfClassList ? outOfClassList.sort((a, b) => a - b).join(',') : '';
    const values = [s.name, s.gender];
    numericCriteria.forEach(({ key }) => values.push(s[key] || 0));
    flagCriteria.forEach(({ key }) => values.push(s[key] ? 1 : 0));
    values.push(apartNum || '');
    values.push(togetherNum || '');
    values.push(outOfClassStr);
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

// Export for Node.js testing (conditional to not break browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateCSVHeaders,
    parseCSVLine,
    parseCSV,
    exportStudentsToCSV,
    exportClassListsToCSV,
    triggerDownload
  };
}
