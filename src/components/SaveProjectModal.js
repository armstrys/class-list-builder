/**
 * SaveProjectModal - Save project to JSON file
 *
 * Uses contexts:
 * - useStudents: Student data, constraints, assignments
 * - useCriteria: Criteria configuration
 * - useAppState: teachers/classes
 *
 * @param {Object} props
 * @param {Function} props.onClose - Close callback
 */
function SaveProjectModal({ onClose }) {
  // Get data from contexts
  const {
    students,
    keepApart,
    keepTogether,
    assignment,
    locked,
    optimizationResults,
  } = useStudentsExport();
  const { numericCriteria, flagCriteria } = useCriteriaExport();
  const { teachers } = useAppStateExport();
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setIsSaving(true);
    
    // Small delay to show loading state
    setTimeout(() => {
      const state = {
        students,
        teachers,
        numericCriteria,
        flagCriteria,
        keepApart,
        keepTogether,
        assignment,
        locked: [...locked], // Convert Set to Array for JSON serialization
        optimizationResults
      };
      
      const projectData = serializeProject(state);
      saveProject(projectData);
      
      setIsSaving(false);
      setSaved(true);
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 1500);
    }, 100);
  }

  const studentCount = students?.length || 0;
  const teacherCount = teachers?.length || 0;
  const hasAssignment = assignment && Object.keys(assignment).length > 0;
  const hasLocked = locked && locked.size > 0;
  
  // Calculate file size estimate (rough approximation)
  const dataSize = JSON.stringify({
    students,
    teachers,
    numericCriteria,
    flagCriteria,
    keepApart,
    keepTogether,
    assignment,
    locked: [...locked],
    optimizationResults
  }).length;
  const fileSizeKB = Math.round(dataSize / 1024 * 10) / 10;

  const footer = (
    <>
      <button 
        className="btn btn-secondary" 
        onClick={onClose}
        disabled={isSaving}
      >
        Cancel
      </button>
      <button 
        className="btn btn-primary" 
        onClick={handleSave}
        disabled={isSaving || saved || studentCount === 0}
      >
        {isSaving ? 'Saving...' : saved ? 'Saved!' : 'Save Project'}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Save Project"
      size="md"
      footer={footer}
    >
      <div className="save-project-summary">
        <p style={{ marginBottom: 16, color: 'var(--text2)' }}>
          Save your complete working state to a file. You can load this project later to continue where you left off.
        </p>
        
        <div className="save-project-stats">
          <div className="save-stat-row">
            <span className="save-stat-label">Students:</span>
            <span className="save-stat-value">{studentCount}</span>
          </div>
          <div className="save-stat-row">
            <span className="save-stat-label">Classes:</span>
            <span className="save-stat-value">{teacherCount}</span>
          </div>
          <div className="save-stat-row">
            <span className="save-stat-label">Keep-apart pairs:</span>
            <span className="save-stat-value">{(keepApart || []).length}</span>
          </div>
          <div className="save-stat-row">
            <span className="save-stat-label">Keep-together groups:</span>
            <span className="save-stat-value">{(keepTogether || []).length}</span>
          </div>
          {hasAssignment && (
            <div className="save-stat-row">
              <span className="save-stat-label">Class assignments:</span>
              <span className="save-stat-value" style={{ color: 'var(--success)' }}>
                ✓ Saved
              </span>
            </div>
          )}
          {hasLocked && (
            <div className="save-stat-row">
              <span className="save-stat-label">Locked students:</span>
              <span className="save-stat-value">{locked.size}</span>
            </div>
          )}
          <div className="save-stat-row">
            <span className="save-stat-label">Estimated file size:</span>
            <span className="save-stat-value">~{fileSizeKB} KB</span>
          </div>
        </div>
        
        <div className="save-project-note" style={{ 
          marginTop: 16, 
          padding: 12, 
          background: 'var(--bg2)', 
          borderRadius: 8,
          fontSize: 13,
          color: 'var(--text3)'
        }}>
          <strong>Privacy note:</strong> This file contains all student data. Store it securely and only share with authorized personnel.
        </div>
      </div>
      
      {saved && (
        <div className="save-success-message" style={{
          marginTop: 16,
          padding: 12,
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid var(--success)',
          borderRadius: 8,
          color: 'var(--success)',
          textAlign: 'center'
        }}>
          ✓ Project saved successfully!
        </div>
      )}
    </Modal>
  );
}
