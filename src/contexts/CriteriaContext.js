/**
 * CriteriaContext - Manages numeric and flag criteria configuration
 * 
 * This context provides global access to:
 * - Numeric criteria (scores with weights)
 * - Flag criteria (boolean attributes with weights)
 * - Persistence to localStorage
 * 
 * @module contexts/CriteriaContext
 */

const CriteriaContext = React.createContext(null);

const STORAGE_KEY_NUMERIC = 'classOptimizer_numericCriteria';
const STORAGE_KEY_FLAG = 'classOptimizer_flagCriteria';

/**
 * Load criteria from localStorage or use defaults
 * @returns {Object} Loaded criteria
 */
function loadCriteriaFromStorage() {
  try {
    const savedNumeric = localStorage.getItem(STORAGE_KEY_NUMERIC);
    const savedFlag = localStorage.getItem(STORAGE_KEY_FLAG);
    
    return {
      numeric: savedNumeric ? JSON.parse(savedNumeric) : DEFAULT_NUMERIC_CRITERIA.map(c => ({ ...c })),
      flag: savedFlag ? JSON.parse(savedFlag) : DEFAULT_FLAG_CRITERIA.map(c => ({ ...c })),
    };
  } catch (e) {
    console.error('Failed to load criteria from localStorage:', e);
    return {
      numeric: DEFAULT_NUMERIC_CRITERIA.map(c => ({ ...c })),
      flag: DEFAULT_FLAG_CRITERIA.map(c => ({ ...c })),
    };
  }
}

/**
 * Provider component for criteria configuration
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element}
 */
function CriteriaProvider({ children }) {
  const [criteria, setCriteria] = useState(() => loadCriteriaFromStorage());

  // Persist to localStorage when criteria change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_NUMERIC, JSON.stringify(criteria.numeric));
      localStorage.setItem(STORAGE_KEY_FLAG, JSON.stringify(criteria.flag));
    } catch (e) {
      console.error('Failed to save criteria to localStorage:', e);
    }
  }, [criteria]);

  const numericCriteria = criteria.numeric;
  const flagCriteria = criteria.flag;

  /**
   * Update numeric criteria array
   * @param {Array} newCriteria - New numeric criteria array
   */
  const setNumericCriteria = useCallback((newCriteria) => {
    setCriteria(prev => ({ ...prev, numeric: newCriteria }));
  }, []);

  /**
   * Update flag criteria array
   * @param {Array} newCriteria - New flag criteria array
   */
  const setFlagCriteria = useCallback((newCriteria) => {
    setCriteria(prev => ({ ...prev, flag: newCriteria }));
  }, []);

  /**
   * Update a specific numeric criterion
   * @param {number} index - Index of criterion to update
   * @param {string} field - Field to update
   * @param {any} value - New value
   */
  const updateNumericCriterion = useCallback((index, field, value) => {
    setCriteria(prev => ({
      ...prev,
      numeric: prev.numeric.map((c, i) => i === index ? { ...c, [field]: value } : c)
    }));
  }, []);

  /**
   * Update a specific flag criterion
   * @param {number} index - Index of criterion to update
   * @param {string} field - Field to update
   * @param {any} value - New value
   */
  const updateFlagCriterion = useCallback((index, field, value) => {
    setCriteria(prev => ({
      ...prev,
      flag: prev.flag.map((c, i) => i === index ? { ...c, [field]: value } : c)
    }));
  }, []);

  /**
   * Add a new numeric criterion
   * @param {Object} criterion - Criterion to add (defaults to empty)
   */
  const addNumericCriterion = useCallback((criterion = { key: '', label: '', short: '', weight: 1.0 }) => {
    setCriteria(prev => ({
      ...prev,
      numeric: [...prev.numeric, criterion]
    }));
  }, []);

  /**
   * Add a new flag criterion
   * @param {Object} criterion - Criterion to add (defaults to empty)
   */
  const addFlagCriterion = useCallback((criterion = { key: '', label: '', short: '', weight: 1.0 }) => {
    setCriteria(prev => ({
      ...prev,
      flag: [...prev.flag, criterion]
    }));
  }, []);

  /**
   * Remove a numeric criterion
   * @param {number} index - Index to remove
   */
  const removeNumericCriterion = useCallback((index) => {
    setCriteria(prev => ({
      ...prev,
      numeric: prev.numeric.filter((_, i) => i !== index)
    }));
  }, []);

  /**
   * Remove a flag criterion
   * @param {number} index - Index to remove
   */
  const removeFlagCriterion = useCallback((index) => {
    setCriteria(prev => ({
      ...prev,
      flag: prev.flag.filter((_, i) => i !== index)
    }));
  }, []);

  /**
   * Reset criteria to defaults
   */
  const resetToDefaults = useCallback(() => {
    setCriteria({
      numeric: DEFAULT_NUMERIC_CRITERIA.map(c => ({ ...c })),
      flag: DEFAULT_FLAG_CRITERIA.map(c => ({ ...c })),
    });
  }, []);

  /**
   * Replace all criteria (used when loading projects)
   * @param {Object} newCriteria - New criteria object
   * @param {Array} newCriteria.numeric - Numeric criteria
   * @param {Array} newCriteria.flag - Flag criteria
   */
  const replaceCriteria = useCallback((newCriteria) => {
    setCriteria({
      numeric: newCriteria.numeric.map(c => ({ ...c })),
      flag: newCriteria.flag.map(c => ({ ...c })),
    });
  }, []);

  const value = {
    // State
    numericCriteria,
    flagCriteria,
    
    // Setters
    setNumericCriteria,
    setFlagCriteria,
    
    // Actions
    updateNumericCriterion,
    updateFlagCriterion,
    addNumericCriterion,
    addFlagCriterion,
    removeNumericCriterion,
    removeFlagCriterion,
    resetToDefaults,
    replaceCriteria,
  };

  return (
    <CriteriaContext.Provider value={value}>
      {children}
    </CriteriaContext.Provider>
  );
}

/**
 * Hook to access criteria context
 * @returns {Object} Criteria context value
 * @throws {Error} If used outside CriteriaProvider
 */
function useCriteria() {
  const context = React.useContext(CriteriaContext);
  if (!context) {
    throw new Error('useCriteria must be used within CriteriaProvider');
  }
  return context;
}

/**
 * Hook to check if criteria are compatible with student data
 * @param {Array} students - Students to check
 * @returns {Object} Compatibility info
 */
function useCriteriaCompatibility(students) {
  const { numericCriteria, flagCriteria } = useCriteria();
  
  return useMemo(() => {
    const numericKeys = numericCriteria.map(c => c.key).filter(Boolean);
    const flagKeys = flagCriteria.map(c => c.key).filter(Boolean);
    
    const usedByStudents = {
      numeric: new Set(),
      flag: new Set(),
    };
    
    students.forEach(student => {
      numericKeys.forEach(key => {
        if (student[key] !== undefined) usedByStudents.numeric.add(key);
      });
      flagKeys.forEach(key => {
        if (student[key] !== undefined) usedByStudents.flag.add(key);
      });
    });
    
    return {
      unusedNumeric: numericKeys.filter(k => !usedByStudents.numeric.has(k)),
      unusedFlag: flagKeys.filter(k => !usedByStudents.flag.has(k)),
      hasUnusedCriteria: usedByStudents.numeric.size < numericKeys.length || 
                         usedByStudents.flag.size < flagKeys.length,
    };
  }, [students, numericCriteria, flagCriteria]);
}
