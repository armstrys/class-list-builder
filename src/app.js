/**
 * App - Root component with context providers
 * 
 * This component initializes all context providers and renders
the main application layout.
 * 
 * @module App
 */

function AppProviders({ children }) {
  return (
    <AppStateProviderExport>
      <CriteriaProviderExport>
        <StudentsProviderExport>
          {children}
        </StudentsProviderExport>
      </CriteriaProviderExport>
    </AppStateProviderExport>
  );
}

function AppContent() {
  // Context hooks
  const { 
    view, navigateToSetup, navigateToOptimize,
    showSettings, openSettings, closeSettings,
    showSaveProject, openSaveProject, closeSaveProject,
    showLoadProject, openLoadProject, closeLoadProject
  } = useAppStateExport();
  
  const { students, setStudents, clearAllStudents } = useStudentsExport();
  const { numericCriteria, flagCriteria, setNumericCriteria, setFlagCriteria } = useCriteriaExport();
  
  // Local state for teachers (not global)
  const [teachers, setTeachers] = useState([
    { id: 'T1', name: 'Class A' },
    { id: 'T2', name: 'Class B' },
    { id: 'T3', name: 'Class C' },
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (students.length > 0) openSaveProject();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        openLoadProject();
      }
    }
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [students.length, openSaveProject, openLoadProject]);

  // Handle project loading
  const handleLoadProject = useCallback((data) => {
    if (data.students) setStudents(data.students);
    if (data.teachers) setTeachers(data.teachers);
    if (data.numericCriteria) setNumericCriteria(data.numericCriteria);
    if (data.flagCriteria) setFlagCriteria(data.flagCriteria);
    
    // Other data is handled by context internals
    if (data.assignment && Object.keys(data.assignment).length > 0) {
      navigateToOptimize();
    } else if (data.students?.length > 0) {
      navigateToSetup();
    }
  }, [setStudents, setTeachers, setNumericCriteria, setFlagCriteria, navigateToOptimize, navigateToSetup]);

  // Handle settings save
  const handleSaveSettings = useCallback((newNumCriteria, newFlagCriteria) => {
    const oldNumKeys = new Set(numericCriteria.map(c => c.key));
    const newNumKeys = new Set(newNumCriteria.map(c => c.key));
    const oldFlagKeys = new Set(flagCriteria.map(c => c.key));
    const newFlagKeys = new Set(newFlagCriteria.map(c => c.key));

    const removedNum = [...oldNumKeys].filter(k => !newNumKeys.has(k));
    const removedFlag = [...oldFlagKeys].filter(k => !newFlagKeys.has(k));

    if (removedNum.length > 0 || removedFlag.length > 0) {
      setStudents(prev => prev.map(s => {
        const updated = { ...s };
        removedNum.forEach(k => delete updated[k]);
        removedFlag.forEach(k => delete updated[k]);
        return updated;
      }));
    }

    setNumericCriteria(newNumCriteria);
    setFlagCriteria(newFlagCriteria);
  }, [numericCriteria, flagCriteria, setNumericCriteria, setFlagCriteria, setStudents]);

  // Export students helper
  const handleExportStudents = useCallback(() => {
    const { keepApart, keepTogether, keepOutOfClass } = useStudentsExport();
    const csv = exportStudentsToCSV(
      students, 
      numericCriteria, 
      flagCriteria, 
      keepApart, 
      keepTogether, 
      keepOutOfClass
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students-backup.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [students, numericCriteria, flagCriteria]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header 
        view={view}
        students={students}
        teachers={teachers}
        onNavigateSetup={navigateToSetup}
        onNavigateOptimize={navigateToOptimize}
        onOpenSettings={openSettings}
        onOpenSave={openSaveProject}
        onOpenLoad={openLoadProject}
      />

      {view === 'setup' ? (
        <SetupPage
          teachers={teachers}
          setTeachers={setTeachers}
          onOptimize={navigateToOptimize}
        />
      ) : (
        <OptimizePage
          teachers={teachers}
          setTeachers={setTeachers}
          onBack={navigateToSetup}
        />
      )}

      {showSettings && (
        <SettingsModal
          onSave={handleSaveSettings}
          onClose={closeSettings}
          hasStudentData={students.length > 0}
          onExportStudents={handleExportStudents}
          onClearStudents={clearAllStudents}
        />
      )}

      {showSaveProject && (
        <SaveProjectModal
          teachers={teachers}
          onClose={closeSaveProject}
        />
      )}

      {showLoadProject && (
        <LoadProjectModal
          onLoad={handleLoadProject}
          onClose={closeLoadProject}
          hasExistingData={students.length > 0}
        />
      )}
    </div>
  );
}

/**
 * Header component extracted from main App
 */
function Header({ 
  view, 
  students, 
  teachers, 
  onNavigateSetup, 
  onNavigateOptimize,
  onOpenSettings,
  onOpenSave,
  onOpenLoad
}) {
  return (
    <header className="app-header">
      <div className="app-logo">Class<span>List</span> Optimizer</div>
      <div className="header-steps">
        <button 
          className={`step-pill ${view === 'setup' ? 'active' : 'done'}`} 
          onClick={onNavigateSetup}
        >
          1 · Setup
        </button>
        <button
          className={`step-pill ${view === 'optimize' ? 'active' : ''}`}
          onClick={() => students.length >= teachers.length && onNavigateOptimize()}
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
            onClick={onOpenSave}
            title="Save project (Ctrl+S)"
          >
            💾 Save Project
          </button>
        )}
        <button 
          className="btn btn-ghost btn-sm" 
          onClick={onOpenLoad}
          title="Load project (Ctrl+O)"
        >
          📂 Load Project
        </button>
        {view === 'setup' && (
          <button 
            className="btn btn-ghost btn-sm" 
            onClick={onOpenSettings}
            title="Configure criteria"
          >
            ⚙️ Settings
          </button>
        )}
      </div>
    </header>
  );
}

function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
