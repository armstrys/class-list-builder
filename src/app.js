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

  const [showSettings, setShowSettings] = useState(false);

  // Persist criteria to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NUMERIC_CRITERIA, JSON.stringify(numericCriteria));
  }, [numericCriteria]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FLAG_CRITERIA, JSON.stringify(flagCriteria));
  }, [flagCriteria]);

  function handleOptimize() {
    setView('optimize');
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
        />
      ) : (
        <OptimizePage
          students={students}
          teachers={teachers}
          setTeachers={setTeachers}
          onBack={() => setView('setup')}
          numericCriteria={numericCriteria}
          flagCriteria={flagCriteria}
        />
      )}

      {showSettings && (
        <SettingsModal
          numericCriteria={numericCriteria}
          flagCriteria={flagCriteria}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
          hasStudentData={students.length > 0}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
