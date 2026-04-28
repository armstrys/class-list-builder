/**
 * AppStateContext - Manages application-level UI state
 * 
 * This context provides global access to:
 * - Current view (setup vs optimize)
 * - Modal visibility states
 * - Keyboard shortcut handlers
 * 
 * @module contexts/AppStateContext
 */

const AppStateContext = React.createContext(null);

/**
 * Provider component for application state
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element}
 */
function AppStateProvider({ children }) {
  // Navigation state
  const [view, setView] = useState('setup'); // 'setup' | 'optimize'
  
  // Modal visibility states
  const [showSettings, setShowSettings] = useState(false);
  const [showSaveProject, setShowSaveProject] = useState(false);
  const [showLoadProject, setShowLoadProject] = useState(false);

  /**
   * Navigate to optimize view
   */
  const navigateToOptimize = useCallback(() => {
    setView('optimize');
  }, []);

  /**
   * Navigate to setup view
   */
  const navigateToSetup = useCallback(() => {
    setView('setup');
  }, []);

  /**
   * Open settings modal
   */
  const openSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  /**
   * Close settings modal
   */
  const closeSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  /**
   * Open save project modal
   */
  const openSaveProject = useCallback(() => {
    setShowSaveProject(true);
  }, []);

  /**
   * Close save project modal
   */
  const closeSaveProject = useCallback(() => {
    setShowSaveProject(false);
  }, []);

  /**
   * Open load project modal
   */
  const openLoadProject = useCallback(() => {
    setShowLoadProject(true);
  }, []);

  /**
   * Close load project modal
   */
  const closeLoadProject = useCallback(() => {
    setShowLoadProject(false);
  }, []);

  /**
   * Close all modals
   */
  const closeAllModals = useCallback(() => {
    setShowSettings(false);
    setShowSaveProject(false);
    setShowLoadProject(false);
  }, []);

  const value = {
    // Navigation
    view,
    setView,
    navigateToOptimize,
    navigateToSetup,
    
    // Modal states
    showSettings,
    showSaveProject,
    showLoadProject,
    
    // Modal actions
    openSettings,
    closeSettings,
    openSaveProject,
    closeSaveProject,
    openLoadProject,
    closeLoadProject,
    closeAllModals,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

/**
 * Hook to access app state context
 * @returns {Object} App state context value
 * @throws {Error} If used outside AppStateProvider
 */
function useAppState() {
  const context = React.useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}

/**
 * Hook for keyboard shortcuts (Ctrl+S, Ctrl+O)
 * @param {Object} options
 * @param {boolean} options.hasStudents - Whether students exist (enables save)
 * @param {Function} options.onSave - Save callback
 * @param {Function} options.onLoad - Load callback
 */
function useKeyboardShortcuts({ hasStudents, onSave, onLoad }) {
  useEffect(() => {
    function handleKeyDown(e) {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasStudents) {
          onSave();
        }
      }
      // Ctrl+O or Cmd+O to load
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        onLoad();
      }
    }
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasStudents, onSave, onLoad]);
}
