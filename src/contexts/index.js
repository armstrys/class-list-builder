/**
 * Contexts index - Central export for all React contexts
 * 
 * @module contexts
 */

// StudentsContext
{
  const StudentsContext = React.createContext(null);
  
  /**
   * Provider component for student-related state
   * @param {Object} props
   * @param {React.ReactNode} props.children - Child components
   * @returns {JSX.Element}
   */
  function StudentsProvider({ children }) {
    const [students, setStudents] = useState([]);
    const [keepApart, setKeepApart] = useState([]);
    const [keepTogether, setKeepTogether] = useState([]);
    const [keepOutOfClass, setKeepOutOfClass] = useState([]);
    const [assignment, setAssignment] = useState({});
    const [locked, setLocked] = useState(new Set());
    const [optimizationResults, setOptimizationResults] = useState(null);

    const addKeepApart = useCallback((id1, id2) => {
      if (id1 === id2) return;
      const pair = id1 < id2 ? [id1, id2] : [id2, id1];
      setKeepApart(prev => {
        const exists = prev.some(p => p[0] === pair[0] && p[1] === pair[1]);
        return exists ? prev : [...prev, pair];
      });
    }, []);

    const removeKeepApart = useCallback((id1, id2) => {
      const pair = id1 < id2 ? [id1, id2] : [id2, id1];
      setKeepApart(prev => prev.filter(p => !(p[0] === pair[0] && p[1] === pair[1])));
    }, []);

    const addKeepTogether = useCallback((studentIds) => {
      if (studentIds.length < 2) return;
      const sortedIds = [...studentIds].sort();
      setKeepTogether(prev => {
        const exists = prev.some(group =>
          group.length === sortedIds.length &&
          group.every((id, i) => id === sortedIds[i])
        );
        return exists ? prev : [...prev, sortedIds];
      });
    }, []);

    const removeKeepTogether = useCallback((groupIndex) => {
      setKeepTogether(prev => prev.filter((_, i) => i !== groupIndex));
    }, []);

    const addKeepOutOfClass = useCallback((studentId, classIndex) => {
      setKeepOutOfClass(prev => {
        const exists = prev.some(c => c.studentId === studentId && c.classIndex === classIndex);
        return exists ? prev : [...prev, { studentId, classIndex }];
      });
    }, []);

    const removeKeepOutOfClass = useCallback((studentId, classIndex) => {
      setKeepOutOfClass(prev => prev.filter(c => !(c.studentId === studentId && c.classIndex === classIndex)));
    }, []);

    const removeStudentConstraints = useCallback((studentId) => {
      setKeepApart(prev => prev.filter(p => p[0] !== studentId && p[1] !== studentId));
      setKeepTogether(prev => prev.filter(group => !group.includes(studentId)));
      setKeepOutOfClass(prev => prev.filter(c => c.studentId !== studentId));
    }, []);

    const clearAllConstraints = useCallback(() => {
      setKeepApart([]);
      setKeepTogether([]);
      setKeepOutOfClass([]);
    }, []);

    const toggleLocked = useCallback((studentId) => {
      setLocked(prev => {
        const next = new Set(prev);
        next.has(studentId) ? next.delete(studentId) : next.add(studentId);
        return next;
      });
    }, []);

    const lockAll = useCallback(() => {
      setLocked(new Set(students.map(s => s.id)));
    }, [students]);

    const unlockAll = useCallback(() => {
      setLocked(new Set());
    }, []);

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
      students, setStudents,
      keepApart, keepTogether, keepOutOfClass,
      assignment, setAssignment,
      locked, setLocked,
      optimizationResults, setOptimizationResults,
      addKeepApart, removeKeepApart,
      addKeepTogether, removeKeepTogether,
      addKeepOutOfClass, removeKeepOutOfClass,
      removeStudentConstraints, clearAllConstraints,
      toggleLocked, lockAll, unlockAll,
      clearAllStudents,
    };

    return (
      <StudentsContext.Provider value={value}>
        {children}
      </StudentsContext.Provider>
    );
  }

  function useStudents() {
    const context = React.useContext(StudentsContext);
    if (!context) throw new Error('useStudents must be used within StudentsProvider');
    return context;
  }

  // Export
  var StudentsContextExport = StudentsContext;
  var StudentsProviderExport = StudentsProvider;
  var useStudentsExport = useStudents;
}

// CriteriaContext
{
  const CriteriaContext = React.createContext(null);
  const STORAGE_KEY_NUMERIC = 'classOptimizer_numericCriteria_v2';
  const STORAGE_KEY_FLAG = 'classOptimizer_flagCriteria_v2';

  function loadCriteriaFromStorage() {
    try {
      const savedNumeric = localStorage.getItem(STORAGE_KEY_NUMERIC);
      const savedFlag = localStorage.getItem(STORAGE_KEY_FLAG);
      return {
        numeric: savedNumeric ? JSON.parse(savedNumeric) : DEFAULT_NUMERIC_CRITERIA.map(c => ({ ...c })),
        flag: savedFlag ? JSON.parse(savedFlag) : DEFAULT_FLAG_CRITERIA.map(c => ({ ...c })),
      };
    } catch (e) {
      return {
        numeric: DEFAULT_NUMERIC_CRITERIA.map(c => ({ ...c })),
        flag: DEFAULT_FLAG_CRITERIA.map(c => ({ ...c })),
      };
    }
  }

  function CriteriaProvider({ children }) {
    const [criteria, setCriteria] = useState(() => loadCriteriaFromStorage());

    useEffect(() => {
      try {
        localStorage.setItem(STORAGE_KEY_NUMERIC, JSON.stringify(criteria.numeric));
        localStorage.setItem(STORAGE_KEY_FLAG, JSON.stringify(criteria.flag));
      } catch (e) {
        console.error('Failed to save criteria:', e);
      }
    }, [criteria]);

    const setNumericCriteria = useCallback((newCriteria) => {
      setCriteria(prev => ({ ...prev, numeric: newCriteria }));
    }, []);

    const setFlagCriteria = useCallback((newCriteria) => {
      setCriteria(prev => ({ ...prev, flag: newCriteria }));
    }, []);

    const updateNumericCriterion = useCallback((index, field, value) => {
      setCriteria(prev => ({
        ...prev,
        numeric: prev.numeric.map((c, i) => i === index ? { ...c, [field]: value } : c)
      }));
    }, []);

    const updateFlagCriterion = useCallback((index, field, value) => {
      setCriteria(prev => ({
        ...prev,
        flag: prev.flag.map((c, i) => i === index ? { ...c, [field]: value } : c)
      }));
    }, []);

    const addNumericCriterion = useCallback((criterion = { key: '', label: '', short: '', weight: 1.0 }) => {
      setCriteria(prev => ({ ...prev, numeric: [...prev.numeric, criterion] }));
    }, []);

    const addFlagCriterion = useCallback((criterion = { key: '', label: '', short: '', weight: 1.0 }) => {
      setCriteria(prev => ({ ...prev, flag: [...prev.flag, criterion] }));
    }, []);

    const removeNumericCriterion = useCallback((index) => {
      setCriteria(prev => ({ ...prev, numeric: prev.numeric.filter((_, i) => i !== index) }));
    }, []);

    const removeFlagCriterion = useCallback((index) => {
      setCriteria(prev => ({ ...prev, flag: prev.flag.filter((_, i) => i !== index) }));
    }, []);

    const resetToDefaults = useCallback(() => {
      setCriteria({
        numeric: DEFAULT_NUMERIC_CRITERIA.map(c => ({ ...c })),
        flag: DEFAULT_FLAG_CRITERIA.map(c => ({ ...c })),
      });
    }, []);

    const replaceCriteria = useCallback((newCriteria) => {
      setCriteria({
        numeric: newCriteria.numeric.map(c => ({ ...c })),
        flag: newCriteria.flag.map(c => ({ ...c })),
      });
    }, []);

    const value = {
      numericCriteria: criteria.numeric,
      flagCriteria: criteria.flag,
      setNumericCriteria, setFlagCriteria,
      updateNumericCriterion, updateFlagCriterion,
      addNumericCriterion, addFlagCriterion,
      removeNumericCriterion, removeFlagCriterion,
      resetToDefaults, replaceCriteria,
    };

    return (
      <CriteriaContext.Provider value={value}>
        {children}
      </CriteriaContext.Provider>
    );
  }

  function useCriteria() {
    const context = React.useContext(CriteriaContext);
    if (!context) throw new Error('useCriteria must be used within CriteriaProvider');
    return context;
  }

  var CriteriaContextExport = CriteriaContext;
  var CriteriaProviderExport = CriteriaProvider;
  var useCriteriaExport = useCriteria;
}

// AppStateContext
{
  const AppStateContext = React.createContext(null);

  function AppStateProvider({ children }) {
    const [view, setView] = useState('setup');
    const [showSettings, setShowSettings] = useState(false);
    const [showSaveProject, setShowSaveProject] = useState(false);
    const [showLoadProject, setShowLoadProject] = useState(false);

    const navigateToOptimize = useCallback(() => setView('optimize'), []);
    const navigateToSetup = useCallback(() => setView('setup'), []);
    const openSettings = useCallback(() => setShowSettings(true), []);
    const closeSettings = useCallback(() => setShowSettings(false), []);
    const openSaveProject = useCallback(() => setShowSaveProject(true), []);
    const closeSaveProject = useCallback(() => setShowSaveProject(false), []);
    const openLoadProject = useCallback(() => setShowLoadProject(true), []);
    const closeLoadProject = useCallback(() => setShowLoadProject(false), []);
    const closeAllModals = useCallback(() => {
      setShowSettings(false);
      setShowSaveProject(false);
      setShowLoadProject(false);
    }, []);

    const value = {
      view, setView, navigateToOptimize, navigateToSetup,
      showSettings, showSaveProject, showLoadProject,
      openSettings, closeSettings,
      openSaveProject, closeSaveProject,
      openLoadProject, closeLoadProject,
      closeAllModals,
    };

    return (
      <AppStateContext.Provider value={value}>
        {children}
      </AppStateContext.Provider>
    );
  }

  function useAppState() {
    const context = React.useContext(AppStateContext);
    if (!context) throw new Error('useAppState must be used within AppStateProvider');
    return context;
  }

  var AppStateContextExport = AppStateContext;
  var AppStateProviderExport = AppStateProvider;
  var useAppStateExport = useAppState;
}
