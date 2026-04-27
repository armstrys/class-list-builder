/**
 * StudentsContext - Manages students, constraints, and assignment state
 * 
 * This context provides global access to:
 * - Student roster and data
 * - Constraint definitions (keep apart, together, out of class)
 * - Optimization assignment results
 * - Locked student assignments
 * 
 * @module contexts/StudentsContext
 */

const StudentsContext = React.createContext(null);

/**
 * Provider component for student-related state
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element}
 */
function StudentsProvider({ children }) {
  // Student roster
  const [students, setStudents] = useState([]);

  // Constraint state
  const [keepApart, setKeepApart] = useState([]);
  const [keepTogether, setKeepTogether] = useState([]);
  const [keepOutOfClass, setKeepOutOfClass] = useState([]);

  // Optimization results
  const [assignment, setAssignment] = useState({});
  const [locked, setLocked] = useState(new Set());
  const [optimizationResults, setOptimizationResults] = useState(null);

  /**
   * Add a keep-apart constraint between two students
   * @param {string} id1 - First student ID
   * @param {string} id2 - Second student ID
   */
  const addKeepApart = useCallback((id1, id2) => {
    if (id1 === id2) return;
    const pair = id1 < id2 ? [id1, id2] : [id2, id1];
    setKeepApart(prev => {
      const exists = prev.some(p => p[0] === pair[0] && p[1] === pair[1]);
      if (exists) return prev;
      return [...prev, pair];
    });
  }, []);

  /**
   * Remove a keep-apart constraint
   * @param {string} id1 - First student ID
   * @param {string} id2 - Second student ID
   */
  const removeKeepApart = useCallback((id1, id2) => {
    const pair = id1 < id2 ? [id1, id2] : [id2, id1];
    setKeepApart(prev => prev.filter(p => !(p[0] === pair[0] && p[1] === pair[1])));
  }, []);

  /**
   * Add a keep-together constraint group
   * @param {string[]} studentIds - Array of student IDs to group
   */
  const addKeepTogether = useCallback((studentIds) => {
    if (studentIds.length < 2) return;
    const sortedIds = [...studentIds].sort();
    setKeepTogether(prev => {
      const exists = prev.some(group =>
        group.length === sortedIds.length &&
        group.every((id, i) => id === sortedIds[i])
      );
      if (exists) return prev;
      return [...prev, sortedIds];
    });
  }, []);

  /**
   * Remove a keep-together constraint
   * @param {number} groupIndex - Index of the group to remove
   */
  const removeKeepTogether = useCallback((groupIndex) => {
    setKeepTogether(prev => prev.filter((_, i) => i !== groupIndex));
  }, []);

  /**
   * Add a keep-out-of-class constraint
   * @param {string} studentId - Student ID
   * @param {number} classIndex - Class index to block
   */
  const addKeepOutOfClass = useCallback((studentId, classIndex) => {
    setKeepOutOfClass(prev => {
      const exists = prev.some(c => c.studentId === studentId && c.classIndex === classIndex);
      if (exists) return prev;
      return [...prev, { studentId, classIndex }];
    });
  }, []);

  /**
   * Remove a keep-out-of-class constraint
   * @param {string} studentId - Student ID
   * @param {number} classIndex - Class index to unblock
   */
  const removeKeepOutOfClass = useCallback((studentId, classIndex) => {
    setKeepOutOfClass(prev => prev.filter(c => !(c.studentId === studentId && c.classIndex === classIndex)));
  }, []);

  /**
   * Remove all constraints involving a specific student
   * @param {string} studentId - Student ID
   */
  const removeStudentConstraints = useCallback((studentId) => {
    setKeepApart(prev => prev.filter(p => p[0] !== studentId && p[1] !== studentId));
    setKeepTogether(prev => prev.filter(group => !group.includes(studentId)));
    setKeepOutOfClass(prev => prev.filter(c => c.studentId !== studentId));
  }, []);

  /**
   * Clear all constraints
   */
  const clearAllConstraints = useCallback(() => {
    setKeepApart([]);
    setKeepTogether([]);
    setKeepOutOfClass([]);
  }, []);

  /**
   * Toggle lock status for a student
   * @param {string} studentId - Student ID
   */
  const toggleLocked = useCallback((studentId) => {
    setLocked(prev => {
      const next = new Set(prev);
      next.has(studentId) ? next.delete(studentId) : next.add(studentId);
      return next;
    }));
  }, []);

  /**
   * Lock all students
   */
  const lockAll = useCallback(() => {
    setLocked(new Set(students.map(s => s.id)));
  }, [students]);

  /**
   * Unlock all students
   */
  const unlockAll = useCallback(() => {
    setLocked(new Set());
  }, []);

  /**
   * Clear all students and constraints
   */
  const clearAllStudents = useCallback(() => {
    setStudents([]);
    setKeepApart([]);
    setKeepTogether([]);
    setKeepOutOfClass([]);
    setAssignment({});
    setLocked(new Set());
    setOptimizationResults(null);
  }, []);

  const value = {
    // State
    students,
    keepApart,
    keepTogether,
    keepOutOfClass,
    assignment,
    locked,
    optimizationResults,
    
    // Setters
    setStudents,
    setAssignment,
    setLocked,
    setOptimizationResults,
    
    // Constraint actions
    addKeepApart,
    removeKeepApart,
    addKeepTogether,
    removeKeepTogether,
    addKeepOutOfClass,
    removeKeepOutOfClass,
    removeStudentConstraints,
    clearAllConstraints,
    
    // Lock actions
    toggleLocked,
    lockAll,
    unlockAll,
    
    // Utility
    clearAllStudents,
  };

  return (
    <StudentsContext.Provider value={value}>
      {children}
    </StudentsContext.Provider>
  );
}

/**
 * Hook to access students context
 * @returns {Object} Students context value
 * @throws {Error} If used outside StudentsProvider
 */
function useStudents() {
  const context = React.useContext(StudentsContext);
  if (!context) {
    throw new Error('useStudents must be used within StudentsProvider');
  }
  return context;
}

/**
 * Hook to access only constraint-related functions
 * @returns {Object} Constraint actions
 */
function useConstraints() {
  const context = useStudents();
  return {
    keepApart: context.keepApart,
    keepTogether: context.keepTogether,
    keepOutOfClass: context.keepOutOfClass,
    addKeepApart: context.addKeepApart,
    removeKeepApart: context.removeKeepApart,
    addKeepTogether: context.addKeepTogether,
    removeKeepTogether: context.removeKeepTogether,
    addKeepOutOfClass: context.addKeepOutOfClass,
    removeKeepOutOfClass: context.removeKeepOutOfClass,
    removeStudentConstraints: context.removeStudentConstraints,
    clearAllConstraints: context.clearAllConstraints,
  };
}

/**
 * Hook to access only assignment-related state
 * @returns {Object} Assignment state and actions
 */
function useAssignment() {
  const context = useStudents();
  return {
    assignment: context.assignment,
    locked: context.locked,
    optimizationResults: context.optimizationResults,
    setAssignment: context.setAssignment,
    setLocked: context.setLocked,
    setOptimizationResults: context.setOptimizationResults,
    toggleLocked: context.toggleLocked,
    lockAll: context.lockAll,
    unlockAll: context.unlockAll,
  };
}
