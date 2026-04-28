/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} canLoad - Whether the project can be loaded
 * @property {string[]} errors - Critical errors that prevent loading
 * @property {string[]} warnings - Non-critical warnings
 * @property {Object|null} data - The validated data (null if cannot load)
 * @property {Object} invalidItems - Details about invalid items found
 * @property {Array} invalidItems.students - Invalid student entries
 * @property {Array} invalidItems.keepApart - Invalid keepApart pairs
 * @property {Array} invalidItems.keepTogether - Invalid keepTogether groups
 */

// PROJECT_FORMAT_VERSION is declared in projectSerializer.js (loaded first in the browser
// bundle). In test contexts that import this file standalone, fall back to the known value.
const EXPECTED_FORMAT_VERSION = (typeof PROJECT_FORMAT_VERSION !== 'undefined') ? PROJECT_FORMAT_VERSION : 1;

/**
 * Parses a version string into components
 * @param {string} version - Version string like "1.3.2"
 * @returns {Object|null} { major, minor, patch } or null if invalid
 */
function parseVersion(version) {
  if (!version || version === 'unknown') return null;
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

/**
 * Checks version compatibility between saved project and current app
 * @param {string} savedVersion - Version from the saved project
 * @param {string} currentVersion - Current app version
 * @returns {Object} { compatible: boolean, warnings: string[], errors: string[] }
 */
function checkVersionCompatibility(savedVersion, currentVersion) {
  const warnings = [];
  const errors = [];
  
  const saved = parseVersion(savedVersion);
  const current = parseVersion(currentVersion);
  
  if (!saved || !current) {
    warnings.push('Unable to determine version compatibility');
    return { compatible: true, warnings, errors };
  }
  
  // Major version mismatch - block
  if (saved.major !== current.major) {
    errors.push(
      `Major version mismatch: Project was saved with v${savedVersion}, ` +
      `but this app is v${currentVersion}. Major version changes may break compatibility. ` +
      `Please use the same major version to load this project.`
    );
    return { compatible: false, warnings, errors };
  }
  
  // Minor version - backward compatible but warn
  if (saved.minor < current.minor) {
    warnings.push(
      `Project was saved with an older version (v${savedVersion}). ` +
      `It will load, but some newer features may not be available.`
    );
  } else if (saved.minor > current.minor) {
    warnings.push(
      `Project was saved with a newer version (v${savedVersion}). ` +
      `It may contain features not available in this version (v${currentVersion}).`
    );
  }
  
  // Patch version - just info
  if (saved.patch !== current.patch) {
    warnings.push(
      `Patch version differs: Project v${savedVersion}, App v${currentVersion}. ` +
      `This is usually fine, but bug fixes may affect behavior.`
    );
  }
  
  return { compatible: true, warnings, errors };
}

/**
 * Checks format version compatibility
 * @param {number} savedFormatVersion - Format version from saved project
 * @returns {Object} { compatible: boolean, error: string|null }
 */
function checkFormatCompatibility(savedFormatVersion) {
  if (savedFormatVersion !== EXPECTED_FORMAT_VERSION) {
    return {
      compatible: false,
      error: `Format version mismatch: Project uses format v${savedFormatVersion}, ` +
             `but this app expects format v${EXPECTED_FORMAT_VERSION}. ` +
             `The project file format may have changed significantly.`
    };
  }
  return { compatible: true, error: null };
}

/**
 * Validates a student object
 * @param {Object} student - Student object to validate
 * @param {Set} validTeacherIds - Set of valid teacher IDs
 * @returns {Object} { valid: boolean, error: string|null, student: Object|null }
 */
function validateStudent(student, validTeacherIds) {
  if (!student || typeof student !== 'object') {
    return { valid: false, error: 'Invalid student data', student: null };
  }
  
  // Check required fields
  if (!student.id) {
    return { valid: false, error: 'Missing student ID', student: null };
  }
  if (!student.name || typeof student.name !== 'string') {
    return { valid: false, error: `Student ${student.id}: Missing or invalid name`, student: null };
  }
  if (!student.gender || !['F', 'M', 'U'].includes(student.gender)) {
    return { valid: false, error: `Student ${student.name}: Invalid gender`, student: null };
  }
  
  // teacherId is required - check if it references a valid teacher
  if (student.teacherId && !validTeacherIds.has(student.teacherId)) {
    return { 
      valid: false, 
      error: `Student ${student.name}: References unknown teacher`, 
      student: null 
    };
  }
  
  return { valid: true, error: null, student };
}

/**
 * Validates a teacher object
 * @param {Object} teacher - Teacher object to validate
 * @returns {Object} { valid: boolean, error: string|null, teacher: Object|null }
 */
function validateTeacher(teacher) {
  if (!teacher || typeof teacher !== 'object') {
    return { valid: false, error: 'Invalid teacher data', teacher: null };
  }
  
  if (!teacher.id) {
    return { valid: false, error: 'Missing teacher ID', teacher: null };
  }
  if (!teacher.name || typeof teacher.name !== 'string') {
    return { valid: false, error: `Teacher ${teacher.id}: Missing or invalid name`, teacher: null };
  }
  
  return { valid: true, error: null, teacher };
}

/**
 * Validates criteria compatibility and returns merge strategy
 * @param {Array} savedNumCriteria - Numeric criteria from saved project
 * @param {Array} savedFlagCriteria - Flag criteria from saved project
 * @param {Array} currentNumCriteria - Current numeric criteria
 * @param {Array} currentFlagCriteria - Current flag criteria
 * @returns {Object} { canProceed: boolean, warnings: string[], mergedNumCriteria: Array, mergedFlagCriteria: Array }
 */
function validateCriteriaCompatibility(savedNumCriteria, savedFlagCriteria, currentNumCriteria, currentFlagCriteria) {
  const warnings = [];
  
  // Build sets of keys
  const savedNumKeys = new Set((savedNumCriteria || []).map(c => c.key));
  const savedFlagKeys = new Set((savedFlagCriteria || []).map(c => c.key));
  const currentNumKeys = new Set((currentNumCriteria || []).map(c => c.key));
  const currentFlagKeys = new Set((currentFlagCriteria || []).map(c => c.key));
  
  // Check for criteria in saved file that don't exist now
  const extraNumCriteria = [...savedNumKeys].filter(k => !currentNumKeys.has(k));
  const extraFlagCriteria = [...savedFlagKeys].filter(k => !currentFlagKeys.has(k));
  
  if (extraNumCriteria.length > 0) {
    warnings.push(
      `Project contains numeric criteria not in current configuration: ${extraNumCriteria.join(', ')}. ` +
      `These will be ignored.`
    );
  }
  
  if (extraFlagCriteria.length > 0) {
    warnings.push(
      `Project contains flag criteria not in current configuration: ${extraFlagCriteria.join(', ')}. ` +
      `These will be ignored.`
    );
  }
  
  // Check for criteria in current config that don't exist in saved file
  const missingNumCriteria = [...currentNumKeys].filter(k => !savedNumKeys.has(k));
  const missingFlagCriteria = [...currentFlagKeys].filter(k => !savedFlagKeys.has(k));
  
  if (missingNumCriteria.length > 0) {
    warnings.push(
      `Current configuration has numeric criteria not in project: ${missingNumCriteria.join(', ')}. ` +
      `Students will have default values for these.`
    );
  }
  
  if (missingFlagCriteria.length > 0) {
    warnings.push(
      `Current configuration has flag criteria not in project: ${missingFlagCriteria.join(', ')}. ` +
      `Students will have default values (false) for these.`
    );
  }
  
  // Use saved criteria configuration if available, otherwise current
  const mergedNumCriteria = savedNumCriteria?.length > 0 ? savedNumCriteria : currentNumCriteria;
  const mergedFlagCriteria = savedFlagCriteria?.length > 0 ? savedFlagCriteria : currentFlagCriteria;
  
  return {
    canProceed: true,
    warnings,
    mergedNumCriteria,
    mergedFlagCriteria
  };
}

/**
 * Validates keepApart pairs
 * @param {Array} keepApart - Array of [id1, id2] pairs
 * @param {Set} validStudentIds - Set of valid student IDs
 * @returns {Object} { validPairs: Array, invalidPairs: Array }
 */
function validateKeepApart(keepApart, validStudentIds) {
  const validPairs = [];
  const invalidPairs = [];
  
  (keepApart || []).forEach((pair, index) => {
    if (!Array.isArray(pair) || pair.length !== 2) {
      invalidPairs.push({ index, pair, reason: 'Invalid format (expected [id1, id2])' });
      return;
    }
    
    const [id1, id2] = pair;
    if (!validStudentIds.has(id1)) {
      invalidPairs.push({ index, pair, reason: `Unknown student ID: ${id1}` });
      return;
    }
    if (!validStudentIds.has(id2)) {
      invalidPairs.push({ index, pair, reason: `Unknown student ID: ${id2}` });
      return;
    }
    
    validPairs.push(pair);
  });
  
  return { validPairs, invalidPairs };
}

/**
 * Validates keepTogether groups
 * @param {Array} keepTogether - Array of student ID groups
 * @param {Set} validStudentIds - Set of valid student IDs
 * @returns {Object} { validGroups: Array, invalidGroups: Array }
 */
function validateKeepTogether(keepTogether, validStudentIds) {
  const validGroups = [];
  const invalidGroups = [];
  
  (keepTogether || []).forEach((group, index) => {
    if (!Array.isArray(group) || group.length < 2) {
      invalidGroups.push({ index, group, reason: 'Invalid format (expected array of at least 2 IDs)' });
      return;
    }
    
    const invalidIds = group.filter(id => !validStudentIds.has(id));
    if (invalidIds.length > 0) {
      invalidGroups.push({ index, group, reason: `Unknown student IDs: ${invalidIds.join(', ')}` });
      return;
    }
    
    validGroups.push(group);
  });
  
  return { validGroups, invalidGroups };
}

/**
 * Validates keepOutOfClass constraints
 * @param {Array} keepOutOfClass - Array of {studentId, classIndex} objects
 * @param {Set} validStudentIds - Set of valid student IDs
 * @param {number} numTeachers - Number of teachers/classes
 * @returns {Object} { validConstraints: Array, invalidConstraints: Array }
 */
function validateKeepOutOfClass(keepOutOfClass, validStudentIds, numTeachers) {
  const validConstraints = [];
  const invalidConstraints = [];

  (keepOutOfClass || []).forEach((constraint, index) => {
    if (!constraint || typeof constraint !== 'object') {
      invalidConstraints.push({ index, constraint, reason: 'Invalid format (expected object with studentId and classIndex)' });
      return;
    }

    const { studentId, classIndex } = constraint;

    if (!studentId || typeof studentId !== 'string') {
      invalidConstraints.push({ index, constraint, reason: 'Missing or invalid studentId' });
      return;
    }

    if (classIndex === undefined || typeof classIndex !== 'number') {
      invalidConstraints.push({ index, constraint, reason: 'Missing or invalid classIndex' });
      return;
    }

    if (!validStudentIds.has(studentId)) {
      invalidConstraints.push({ index, constraint, reason: `Unknown student ID: ${studentId}` });
      return;
    }

    if (classIndex < 0 || classIndex >= numTeachers) {
      invalidConstraints.push({ index, constraint, reason: `Invalid classIndex: ${classIndex} (must be 0-${numTeachers - 1})` });
      return;
    }

    validConstraints.push(constraint);
  });

  return { validConstraints, invalidConstraints };
}

/**
 * Deserializes and validates a project file
 * @param {string|Object} projectData - The project data (JSON string or parsed object)
 * @param {Object} options - Options for validation
 * @param {string} options.currentVersion - Current app version
 * @param {Array} options.currentNumCriteria - Current numeric criteria
 * @param {Array} options.currentFlagCriteria - Current flag criteria
 * @returns {ValidationResult}
 */
function deserializeProject(projectData, options = {}) {
  const errors = [];
  const warnings = [];
  const invalidItems = {
    students: [],
    teachers: [],
    keepApart: [],
    keepTogether: [],
    keepOutOfClass: []
  };
  
  const currentVersion = options.currentVersion || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown');
  
  // Parse JSON if string
  let data;
  try {
    data = typeof projectData === 'string' ? JSON.parse(projectData) : projectData;
  } catch (e) {
    return {
      canLoad: false,
      errors: ['Invalid JSON format: ' + e.message],
      warnings: [],
      data: null,
      invalidItems
    };
  }
  
  // Check metadata
  if (!data.metadata) {
    return {
      canLoad: false,
      errors: ['Missing metadata section'],
      warnings: [],
      data: null,
      invalidItems
    };
  }
  
  // Check format version
  const formatCheck = checkFormatCompatibility(data.metadata.formatVersion);
  if (!formatCheck.compatible) {
    return {
      canLoad: false,
      errors: [formatCheck.error],
      warnings: [],
      data: null,
      invalidItems
    };
  }
  
  // Check app version compatibility
  const versionCheck = checkVersionCompatibility(data.metadata.appVersion, currentVersion);
  warnings.push(...versionCheck.warnings);
  if (!versionCheck.compatible) {
    return {
      canLoad: false,
      errors: versionCheck.errors,
      warnings,
      data: null,
      invalidItems
    };
  }
  
  // Check data section
  if (!data.data) {
    return {
      canLoad: false,
      errors: ['Missing data section'],
      warnings,
      data: null,
      invalidItems
    };
  }
  
  const { data: projectState } = data;
  
  // Validate teachers first (needed for student validation)
  const validatedTeachers = [];
  (projectState.teachers || []).forEach((teacher, index) => {
    const result = validateTeacher(teacher);
    if (result.valid) {
      validatedTeachers.push(result.teacher);
    } else {
      invalidItems.teachers.push({ index, teacher, reason: result.error });
    }
  });
  
  const validTeacherIds = new Set(validatedTeachers.map(t => t.id));
  
  // Validate students
  const validatedStudents = [];
  (projectState.students || []).forEach((student, index) => {
    const result = validateStudent(student, validTeacherIds);
    if (result.valid) {
      validatedStudents.push(result.student);
    } else {
      invalidItems.students.push({ index, student, reason: result.error });
    }
  });
  
  const validStudentIds = new Set(validatedStudents.map(s => s.id));
  
  // Validate constraints
  const keepApartResult = validateKeepApart(projectState.keepApart, validStudentIds);
  invalidItems.keepApart = keepApartResult.invalidPairs;

  const keepTogetherResult = validateKeepTogether(projectState.keepTogether, validStudentIds);
  invalidItems.keepTogether = keepTogetherResult.invalidGroups;

  const keepOutOfClassResult = validateKeepOutOfClass(projectState.keepOutOfClass, validStudentIds, validatedTeachers.length);
  invalidItems.keepOutOfClass = keepOutOfClassResult.invalidConstraints;
  
  // Check criteria compatibility
  const criteriaCheck = validateCriteriaCompatibility(
    projectState.numericCriteria,
    projectState.flagCriteria,
    options.currentNumCriteria || [],
    options.currentFlagCriteria || []
  );
  warnings.push(...criteriaCheck.warnings);
  
  // Process assignment if present (now a standard field)
  const assignment = {};
  if (projectState.assignment) {
    // Validate assignment - only include valid student/teacher pairs
    Object.entries(projectState.assignment).forEach(([studentId, teacherIndex]) => {
      if (validStudentIds.has(studentId) && teacherIndex >= 0 && teacherIndex < validatedTeachers.length) {
        assignment[studentId] = teacherIndex;
      }
    });
  }
  
  // Process locked students if present
  let locked = [];
  if (projectState.locked && Array.isArray(projectState.locked)) {
    // Only include locked students that exist in the valid students
    locked = projectState.locked.filter(id => validStudentIds.has(id));
  }
  
  // Process optimization results if present (deprecated but still supported)
  let optimizationResults = null;
  if (projectState.optimizationResults) {
    // Convert plain object back to Map
    const assignments = new Map();
    const savedAssignments = projectState.optimizationResults.assignments || {};
    
    // Only include assignments for valid students
    Object.entries(savedAssignments).forEach(([studentId, teacherIndex]) => {
      if (validStudentIds.has(studentId) && teacherIndex >= 0 && teacherIndex < validatedTeachers.length) {
        assignments.set(studentId, teacherIndex);
      }
    });
    
    optimizationResults = {
      score: projectState.optimizationResults.score,
      iterations: projectState.optimizationResults.iterations,
      assignments
    };
  }
  
  // Determine if we can load
  const canLoad = errors.length === 0;
  
  // Build result data
  const resultData = canLoad ? {
    students: validatedStudents,
    teachers: validatedTeachers,
    numericCriteria: criteriaCheck.mergedNumCriteria,
    flagCriteria: criteriaCheck.mergedFlagCriteria,
    keepApart: keepApartResult.validPairs,
    keepTogether: keepTogetherResult.validGroups,
    keepOutOfClass: keepOutOfClassResult.validConstraints,
    assignment,
    locked,
    optimizationResults
  } : null;
  
  // Add warnings about invalid items
  if (invalidItems.students.length > 0) {
    warnings.push(`${invalidItems.students.length} student(s) could not be loaded due to invalid data.`);
  }
  if (invalidItems.teachers.length > 0) {
    warnings.push(`${invalidItems.teachers.length} teacher(s) could not be loaded due to invalid data.`);
  }
  if (invalidItems.keepApart.length > 0) {
    warnings.push(`${invalidItems.keepApart.length} keep-apart constraint(s) skipped due to invalid references.`);
  }
  if (invalidItems.keepTogether.length > 0) {
    warnings.push(`${invalidItems.keepTogether.length} keep-together group(s) skipped due to invalid references.`);
  }
  if (invalidItems.keepOutOfClass.length > 0) {
    warnings.push(`${invalidItems.keepOutOfClass.length} keep-out-of-class constraint(s) skipped due to invalid references.`);
  }

  return {
    canLoad,
    errors,
    warnings,
    data: resultData,
    invalidItems
  };
}

/**
 * Reads a project file from a File object
 * @param {File} file - The file to read
 * @returns {Promise<Object>} The parsed project data
 */
function readProjectFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(data);
      } catch (err) {
        reject(new Error('Invalid JSON format: ' + err.message));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsText(file);
  });
}

// Export for Node.js testing (conditional to not break browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    deserializeProject,
    readProjectFile,
    parseVersion,
    checkVersionCompatibility,
    checkFormatCompatibility,
    validateStudent,
    validateTeacher,
    validateCriteriaCompatibility,
    validateKeepApart,
    validateKeepTogether,
    validateKeepOutOfClass,
    PROJECT_FORMAT_VERSION: EXPECTED_FORMAT_VERSION,
  };
}
