const PROJECT_FORMAT_VERSION = 1;

/**
 * Serializes the complete application state to a project file format.
 * @param {Object} state - The application state
 * @param {Array} state.students - Array of student objects
 * @param {Array} state.teachers - Array of teacher/class definitions
 * @param {Array} state.numericCriteria - Configured numeric criteria
 * @param {Array} state.flagCriteria - Configured flag criteria
 * @param {Array} state.keepApart - Array of [id1, id2] pairs
 * @param {Array} state.keepTogether - Array of student ID groups
 * @param {Array} state.keepOutOfClass - Array of {studentId, classIndex} constraints
 * @param {Object} state.optimizationResults - Optional optimization results
 * @param {Map} state.optimizationResults.assignments - Map of studentId -> teacherIndex
 * @param {number} state.optimizationResults.score - Optimization score
 * @param {number} state.optimizationResults.iterations - Number of iterations run
 * @returns {Object} Serialized project data ready for JSON.stringify
 */
function serializeProject(state) {
  const appVersion = typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown';
  
  const projectData = {
    metadata: {
      appVersion,
      formatVersion: PROJECT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      description: 'Class List Optimizer Project File'
    },
    data: {
      students: state.students || [],
      teachers: state.teachers || [],
      numericCriteria: state.numericCriteria || [],
      flagCriteria: state.flagCriteria || [],
      keepApart: state.keepApart || [],
      keepTogether: state.keepTogether || [],
      keepOutOfClass: state.keepOutOfClass || [],
      assignment: state.assignment || {},
      locked: state.locked || []
    }
  };

  // Include optimization results if provided
  if (state.optimizationResults) {
    projectData.data.optimizationResults = {
      score: state.optimizationResults.score,
      iterations: state.optimizationResults.iterations,
      // Convert Map to plain object for JSON serialization
      assignments: state.optimizationResults.assignments ? 
        Object.fromEntries(state.optimizationResults.assignments) : {}
    };
  }

  return projectData;
}

/**
 * Generates a filename for the project export.
 * Format: classlist-project-YYYY-MM-DD.json
 * @returns {string} Filename
 */
function generateProjectFilename() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `classlist-project-${year}-${month}-${day}.json`;
}

/**
 * Creates a blob URL for saving the project file.
 * @param {Object} projectData - The serialized project data
 * @returns {string} Blob URL for saving
 */
function createProjectSaveUrl(projectData) {
  const json = JSON.stringify(projectData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  return URL.createObjectURL(blob);
}

/**
 * Triggers a save of the project file.
 * @param {Object} projectData - The serialized project data
 */
function saveProject(projectData) {
  const url = createProjectSaveUrl(projectData);
  const filename = generateProjectFilename();
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export for Node.js testing (conditional to not break browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    serializeProject,
    generateProjectFilename,
    createProjectSaveUrl,
    saveProject,
    PROJECT_FORMAT_VERSION
  };
}
