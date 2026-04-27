function App() {
  const [view, setView] = useState('setup');
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([
    { id: 'T1', name: 'Class A' },
    { id: 'T2', name: 'Class B' },
    { id: 'T3', name: 'Class C' },
  ]);

  // Criteria state with localStorage persistence
  const [numericCriteria, setNumericCriteria] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.NUMERIC_CRITERIA);
    return saved ? JSON.parse(saved) : DEFAULT_NUMERIC_CRITERIA.map(c => ({ ...c }));
  });

  const [flagCriteria, setFlagCriteria] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FLAG_CRITERIA);
    return saved ? JSON.parse(saved) : DEFAULT_FLAG_CRITERIA.map(c => ({ ...c }));
  });

  // Keep apart constraints: array of [studentId1, studentId2] pairs
  const [keepApart, setKeepApart] = useState([]);

  // Keep together constraints: array of student ID groups
  const [keepTogether, setKeepTogether] = useState([]);

  // Keep out of class constraints: array of {studentId, classIndex} objects
  const [keepOutOfClass, setKeepOutOfClass] = useState([]);

  const [showSettings, setShowSettings] = useState(false);
  const [showSaveProject, setShowSaveProject] = useState(false);
  const [showLoadProject, setShowLoadProject] = useState(false);
  
  // Track optimization state for save/load
  const [assignment, setAssignment] = useState({});
  const [locked, setLocked] = useState(new Set());
  const [optimizationResults, setOptimizationResults] = useState(null);

  // Persist criteria to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NUMERIC_CRITERIA, JSON.stringify(numericCriteria));
  }, [numericCriteria]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FLAG_CRITERIA, JSON.stringify(flagCriteria));
  }, [flagCriteria]);

  // Keyboard shortcuts for save/load
  useEffect(() => {
    function handleKeyDown(e) {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (students.length > 0) {
          setShowSaveProject(true);
        }
      }
      // Ctrl+O or Cmd+O to load
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        setShowLoadProject(true);
      }
    }
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [students.length]);

  function handleOptimize() {
    setView('optimize');
  }

  // Add a keep-apart constraint between two students
  function addKeepApart(id1, id2) {
    if (id1 === id2) return;
    // Ensure consistent ordering (smaller ID first)
    const pair = id1 < id2 ? [id1, id2] : [id2, id1];
    setKeepApart(prev => {
      // Don't add duplicates
      const exists = prev.some(p => p[0] === pair[0] && p[1] === pair[1]);
      if (exists) return prev;
      return [...prev, pair];
    });
  }

  // Remove a keep-apart constraint
  function removeKeepApart(id1, id2) {
    const pair = id1 < id2 ? [id1, id2] : [id2, id1];
    setKeepApart(prev => prev.filter(p => !(p[0] === pair[0] && p[1] === pair[1])));
  }

  // Add a keep-together group
  function addKeepTogether(studentIds) {
    if (studentIds.length < 2) return;
    const sortedIds = [...studentIds].sort();
    setKeepTogether(prev => {
      // Don't add duplicates (check if same group already exists)
      const exists = prev.some(group =>
        group.length === sortedIds.length &&
        group.every((id, i) => id === sortedIds[i])
      );
      if (exists) return prev;
      return [...prev, sortedIds];
    });
  }

  // Remove a keep-together group
  function removeKeepTogether(groupIndex) {
    setKeepTogether(prev => prev.filter((_, i) => i !== groupIndex));
  }

  // Remove all constraints involving a student (when student is deleted)
  function removeStudentConstraints(studentId) {
    setKeepApart(prev => prev.filter(p => p[0] !== studentId && p[1] !== studentId));
    setKeepTogether(prev => prev.filter(group => !group.includes(studentId)));
    setKeepOutOfClass(prev => prev.filter(c => c.studentId !== studentId));
  }

  // Add a keep-out-of-class constraint
  function addKeepOutOfClass(studentId, classIndex) {
    setKeepOutOfClass(prev => {
      // Don't add duplicates
      const exists = prev.some(c => c.studentId === studentId && c.classIndex === classIndex);
      if (exists) return prev;
      return [...prev, { studentId, classIndex }];
    });
  }

  // Remove a keep-out-of-class constraint
  function removeKeepOutOfClass(studentId, classIndex) {
    setKeepOutOfClass(prev => prev.filter(c => !(c.studentId === studentId && c.classIndex === classIndex)));
  }

  // Get all keep-out-of-class constraints for a student
  function getKeepOutOfClassForStudent(studentId) {
    return keepOutOfClass.filter(c => c.studentId === studentId);
  }

  // Clear all keep-out-of-class constraints for a student
  function clearKeepOutOfClassForStudent(studentId) {
    setKeepOutOfClass(prev => prev.filter(c => c.studentId !== studentId));
  }

  function handleLoadProject(data) {
    // Load all the project data
    if (data.students) setStudents(data.students);
    if (data.teachers) setTeachers(data.teachers);
    if (data.numericCriteria) setNumericCriteria(data.numericCriteria);
    if (data.flagCriteria) setFlagCriteria(data.flagCriteria);
    if (data.keepApart) setKeepApart(data.keepApart);
    if (data.keepTogether) setKeepTogether(data.keepTogether);
    if (data.keepOutOfClass) setKeepOutOfClass(data.keepOutOfClass);
    if (data.optimizationResults) setOptimizationResults(data.optimizationResults);
    if (data.assignment) setAssignment(data.assignment);
    if (data.locked) {
      // Convert array back to Set
      setLocked(new Set(data.locked));
    }

    // Switch to optimize view if we have an assignment, otherwise setup
    if (data.assignment && Object.keys(data.assignment).length > 0) {
      setView('optimize');
    } else if (data.students?.length > 0) {
      setView('setup');
    }
  }

  function handleSaveSettings(newNumCriteria, newFlagCriteria) {
    // Check if criteria changed - if so, we need to warn or clear student data
    const oldNumKeys = new Set(numericCriteria.map(c => c.key));
    const newNumKeys = new Set(newNumCriteria.map(c => c.key));
    const oldFlagKeys = new Set(flagCriteria.map(c => c.key));
    const newFlagKeys = new Set(newFlagCriteria.map(c => c.key));

    // Check if any fields were removed
    const removedNum = [...oldNumKeys].filter(k => !newNumKeys.has(k));
    const removedFlag = [...oldFlagKeys].filter(k => !newFlagKeys.has(k));

    if (removedNum.length > 0 || removedFlag.length > 0) {
      // Remove those fields from all students
      setStudents(prev => prev.map(s => {
        const updated = { ...s };
        removedNum.forEach(k => delete updated[k]);
        removedFlag.forEach(k => delete updated[k]);
        return updated;
      }));
    }

    setNumericCriteria(newNumCriteria);
    setFlagCriteria(newFlagCriteria);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header className="app-header">
        <div className="app-logo">Class<span>List</span> Optimizer</div>
        <div className="header-steps">
          <button className={`step-pill ${view === 'setup' ? 'active' : 'done'}`} onClick={() => setView('setup')}>
            1 · Setup
          </button>
          <button
            className={`step-pill ${view === 'optimize' ? 'active' : ''}`}
            onClick={() => students.length >= teachers.length && setView('optimize')}
            disabled={students.length < teachers.length}
          >
            2 · Optimize
          </button>
        </div>
        <div className="header-right">
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {students.length} students · {teachers.length} classes
          </span>
          {students.length > 0 && (
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={() => setShowSaveProject(true)} 
              title="Save project (Ctrl+S)"
            >
              💾 Save Project
            </button>
          )}
          <button 
            className="btn btn-ghost btn-sm" 
            onClick={() => setShowLoadProject(true)} 
            title="Load project (Ctrl+O)"
          >
            📂 Load Project
          </button>
          {view === 'setup' && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(true)} title="Configure criteria">
              ⚙️ Settings
            </button>
          )}
        </div>
      </header>

      {view === 'setup' ? (
        <SetupPage
          students={students}
          setStudents={setStudents}
          teachers={teachers}
          setTeachers={setTeachers}
          onOptimize={handleOptimize}
          numericCriteria={numericCriteria}
          flagCriteria={flagCriteria}
          onOpenSettings={() => setShowSettings(true)}
          keepApart={keepApart}
          onAddKeepApart={addKeepApart}
          onRemoveKeepApart={removeKeepApart}
          keepTogether={keepTogether}
          onAddKeepTogether={addKeepTogether}
          onRemoveKeepTogether={removeKeepTogether}
          keepOutOfClass={keepOutOfClass}
          onAddKeepOutOfClass={addKeepOutOfClass}
          onRemoveKeepOutOfClass={removeKeepOutOfClass}
          onRemoveStudentConstraints={removeStudentConstraints}
        />
      ) : (
        <OptimizePage
          students={students}
          teachers={teachers}
          setTeachers={setTeachers}
          onBack={() => setView('setup')}
          numericCriteria={numericCriteria}
          flagCriteria={flagCriteria}
          keepApart={keepApart}
          onAddKeepApart={addKeepApart}
          onRemoveKeepApart={removeKeepApart}
          keepTogether={keepTogether}
          onAddKeepTogether={addKeepTogether}
          onRemoveKeepTogether={removeKeepTogether}
          keepOutOfClass={keepOutOfClass}
          onAddKeepOutOfClass={addKeepOutOfClass}
          onRemoveKeepOutOfClass={removeKeepOutOfClass}
          assignment={assignment}
          setAssignment={setAssignment}
          locked={locked}
          setLocked={setLocked}
        />
      )}

      {showSettings && (
        <SettingsModal
          numericCriteria={numericCriteria}
          flagCriteria={flagCriteria}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
          hasStudentData={students.length > 0}
          onExportStudents={() => {
            // Export current students before clearing
            // exportStudentsToCSV is globally available from csv.js
            const csv = exportStudentsToCSV(students, numericCriteria, flagCriteria, keepApart, keepTogether, keepOutOfClass);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'students-backup.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          onClearStudents={() => {
            setStudents([]);
            setKeepApart([]);
            setKeepTogether([]);
            setKeepOutOfClass([]);
          }}
        />
      )}

      {showSaveProject && (
        <SaveProjectModal
          students={students}
          teachers={teachers}
          numericCriteria={numericCriteria}
          flagCriteria={flagCriteria}
          keepApart={keepApart}
          keepTogether={keepTogether}
          keepOutOfClass={keepOutOfClass}
          assignment={assignment}
          locked={locked}
          optimizationResults={optimizationResults}
          onClose={() => setShowSaveProject(false)}
        />
      )}

      {showLoadProject && (
        <LoadProjectModal
          onLoad={handleLoadProject}
          onClose={() => setShowLoadProject(false)}
          currentNumCriteria={numericCriteria}
          currentFlagCriteria={flagCriteria}
          hasExistingData={students.length > 0}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
