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
        <StudentsProviderExport>{children}</StudentsProviderExport>
      </CriteriaProviderExport>
    </AppStateProviderExport>
  );
}

function AppContent() {
  // Context hooks
  const {
    view,
    navigateToSetup,
    navigateToOptimize,
    showSettings,
    openSettings,
    closeSettings,
    showSaveProject,
    openSaveProject,
    closeSaveProject,
    showLoadProject,
    openLoadProject,
    closeLoadProject,
    teachers,
    setTeachers,
  } = useAppStateExport();

  const {
    students,
    setStudents,
    clearAllStudents,
    replaceAllStudents,
    setKeepApart,
    setKeepTogether,
    setKeepOutOfClass,
    setAssignment,
    setLocked,
  } = useStudentsExport();
  const {
    numericCriteria,
    flagCriteria,
    categoryCriteria,
    setNumericCriteria,
    setFlagCriteria,
    setCategoryCriteria,
  } = useCriteriaExport();

  const [currentTourStep, setCurrentTourStep] = useState(null);

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
      // Escape belongs to an open dialog first; the tour is not modal.
      if (e.key === 'Escape' && !document.querySelector('.modal-overlay')) {
        setCurrentTourStep(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [students.length, openSaveProject, openLoadProject]);

  // Students and assignments live only in memory, so an accidental reload or
  // tab close destroys the whole session. Browsers ignore custom copy here.
  const hasWorkInProgress = students.length > 0;
  useEffect(() => {
    if (!hasWorkInProgress) return;
    function handleBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasWorkInProgress]);

  // Handle project loading
  const handleLoadProject = useCallback(
    data => {
      // Use replaceAllStudents to ensure clean state when loading new project
      if (data.students) {
        replaceAllStudents(data.students);
      }
      if (data.teachers) setTeachers(data.teachers);
      if (data.numericCriteria) setNumericCriteria(data.numericCriteria);
      if (data.flagCriteria) setFlagCriteria(data.flagCriteria);
      if (data.categoryCriteria) setCategoryCriteria(data.categoryCriteria);
      // replaceAllStudents reset constraints/assignment/locked to empty;
      // restore them from the project payload if present.
      if (data.keepApart?.length > 0) setKeepApart(data.keepApart);
      if (data.keepTogether?.length > 0) setKeepTogether(data.keepTogether);
      if (data.keepOutOfClass?.length > 0) setKeepOutOfClass(data.keepOutOfClass);
      if (data.assignment && Object.keys(data.assignment).length > 0) {
        setAssignment(data.assignment);
      }
      if (data.locked?.length > 0) {
        setLocked(new Set(data.locked));
      }

      if (data.assignment && Object.keys(data.assignment).length > 0) {
        navigateToOptimize();
      } else if (data.students?.length > 0) {
        navigateToSetup();
      }
    },
    [
      replaceAllStudents,
      setTeachers,
      setNumericCriteria,
      setFlagCriteria,
      setKeepApart,
      setKeepTogether,
      setKeepOutOfClass,
      setAssignment,
      setLocked,
      navigateToOptimize,
      navigateToSetup,
    ]
  );

  // Handle settings save
  const handleSaveSettings = useCallback(
    (newNumCriteria, newFlagCriteria, newCategoryCriteria) => {
      const oldNumKeys = new Set(numericCriteria.map(c => c.key));
      const newNumKeys = new Set(newNumCriteria.map(c => c.key));
      const oldFlagKeys = new Set(flagCriteria.map(c => c.key));
      const newFlagKeys = new Set(newFlagCriteria.map(c => c.key));
      const oldCatKeys = new Set(categoryCriteria.map(c => c.key));
      const newCatKeys = new Set((newCategoryCriteria || []).map(c => c.key));

      const removedNum = [...oldNumKeys].filter(k => !newNumKeys.has(k));
      const removedFlag = [...oldFlagKeys].filter(k => !newFlagKeys.has(k));
      const removedCat = [...oldCatKeys].filter(k => !newCatKeys.has(k));

      if (removedNum.length > 0 || removedFlag.length > 0 || removedCat.length > 0) {
        setStudents(prev =>
          prev.map(s => {
            const updated = { ...s };
            removedNum.forEach(k => delete updated[k]);
            removedFlag.forEach(k => delete updated[k]);
            removedCat.forEach(k => delete updated[k]);
            return updated;
          })
        );
      }

      setNumericCriteria(newNumCriteria);
      setFlagCriteria(newFlagCriteria);
      if (newCategoryCriteria) setCategoryCriteria(newCategoryCriteria);
    },
    [numericCriteria, flagCriteria, categoryCriteria, setNumericCriteria, setFlagCriteria, setCategoryCriteria, setStudents]
  );

  // Export students helper
  const handleExportStudents = useCallback(() => {
    const csv = exportStudentsToCSV(
      students,
      numericCriteria,
      flagCriteria,
      categoryCriteria
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
  }, [students, numericCriteria, flagCriteria, categoryCriteria]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header
        onNavigateSetup={navigateToSetup}
        onNavigateOptimize={navigateToOptimize}
        onOpenSettings={openSettings}
        onOpenSave={openSaveProject}
        onOpenLoad={openLoadProject}
        onStartTour={() => setCurrentTourStep(0)}
      />

      {view === 'setup' ? (
        <SetupPage onOptimize={navigateToOptimize} />
      ) : (
        <OptimizePage onBack={navigateToSetup} />
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

      {showSaveProject && <SaveProjectModal onClose={closeSaveProject} />}

      {showLoadProject && (
        <LoadProjectModal
          onLoad={handleLoadProject}
          onClose={closeLoadProject}
          hasExistingData={students.length > 0}
        />
      )}

      {currentTourStep !== null && (
        <Tour currentTourStep={currentTourStep} setCurrentTourStep={setCurrentTourStep} />
      )}

      <WelcomeModal
        onLoadDemo={() => {
          setCurrentTourStep(0);
          const demoStudents = generateSampleStudents(
            DEFAULT_SAMPLE_COUNT,
            numericCriteria,
            flagCriteria,
            categoryCriteria
          );
          replaceAllStudents(demoStudents);
          // Generate random constraints after students are created
          const numClasses = teachers.length;
          const constraints = generateSampleConstraints(demoStudents, numClasses);
          setKeepApart(constraints.keepApart);
          setKeepTogether(constraints.keepTogether);
          setKeepOutOfClass(constraints.keepOutOfClass);
        }}
      />
    </div>
  );
}

/**
 * Header component extracted from main App
 */
function Header({ onNavigateSetup, onNavigateOptimize, onOpenSettings, onOpenSave, onOpenLoad, onStartTour }) {
  const { view, teachers, theme, toggleTheme } = useAppStateExport();
  const { students } = useStudentsExport();
  return (
    <header className="app-header">
      <div className="app-logo">
        Class<span>List</span> Builder
      </div>
      {/* Orientation controls sit with the identity, ahead of the view pills:
          the tour teaches this page, and the mark is a link out, so neither is
          a view switch. The tour is setup-only, like Settings, because every
          step names a control on this page. */}
      <div className="header-aux">
        <a
          className="btn btn-ghost btn-sm header-github"
          href="https://github.com/armstrys/class-list-builder"
          target="_blank"
          rel="noopener noreferrer"
          title="Class List Builder on GitHub (opens in a new tab)"
          aria-label="Class List Builder on GitHub (opens in a new tab)"
        >
          <GitHubMark />
        </a>
        {view === 'setup' && (
          <button
            className="btn btn-secondary btn-sm tour-start"
            onClick={onStartTour}
            title="Take the tour"
            aria-label="Take the tour"
          >
            <span aria-hidden="true">❓</span>
            <span className="tour-start-label">Take a tour</span>
          </button>
        )}
      </div>
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
            data-tour="save"
            title="Save project (Ctrl+S)"
          >
            💾 Save Project
          </button>
        )}
        {/* Second anchor for the tour's save/load step, so the callout still
            lands on a real control before any students exist. */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={onOpenLoad}
          data-tour="save"
          title="Load project (Ctrl+O)"
        >
          📂 Load Project
        </button>
        {view === 'setup' && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onOpenSettings}
            data-tour="criteria"
            title="Configure criteria"
          >
            ⚙️ Settings
          </button>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}

/**
 * GitHubMark - The GitHub logo, in currentColor so it follows the ghost button.
 *
 * Authored inline rather than an emoji or an icon font: there is no octocat
 * emoji, and a font or image would be another request for a 14px mark.
 */
function GitHubMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none' }}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
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
