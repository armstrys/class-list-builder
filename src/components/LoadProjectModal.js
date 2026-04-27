/**
 * LoadProjectModal - Load project from JSON file
 * 
 * Uses contexts:
 * - useCriteria: To check compatibility with current criteria
 * 
 * @param {Object} props
 * @param {Function} props.onLoad - Load callback
 * @param {Function} props.onClose - Close callback
 * @param {boolean} props.hasExistingData - Whether data already exists
 */
function LoadProjectModal({
  onLoad,
  onClose,
  hasExistingData
}) {
  // Get current criteria from context for compatibility checking
  const { numericCriteria: currentNumCriteria, flagCriteria: currentFlagCriteria } = useCriteriaExport();
  const [file, setFile] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadMode, setLoadMode] = useState(null); // 'compatible', 'force', or null
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const currentVersion = typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown';

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const droppedFile = files[0];
      if (droppedFile.name.endsWith('.json')) {
        processFile(droppedFile);
      } else {
        setError('Please drop a JSON project file (.json)');
      }
    }
  }

  function handleFileSelect(e) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
    e.target.value = ''; // Reset input
  }

  async function processFile(selectedFile) {
    setError('');
    setFile(selectedFile);
    setIsLoading(true);
    setValidationResult(null);
    setLoadMode(null);
    setShowOverwriteConfirm(false);

    try {
      const projectData = await readProjectFile(selectedFile);
      const result = deserializeProject(projectData, {
        currentVersion,
        currentNumCriteria,
        currentFlagCriteria
      });
      
      setValidationResult(result);
      
      // Auto-select load mode based on validation
      if (!result.canLoad) {
        setLoadMode(null);
      } else if (result.warnings.length === 0 && 
                 result.invalidItems.students.length === 0 &&
                 result.invalidItems.teachers.length === 0 &&
                 result.invalidItems.keepApart.length === 0 &&
                 result.invalidItems.keepTogether.length === 0) {
        setLoadMode('compatible');
      } else {
        setLoadMode(null); // Wait for user to choose
      }
    } catch (err) {
      setError(err.message);
      setValidationResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  function handleLoad() {
    if (!validationResult || !validationResult.canLoad) return;
    
    if (hasExistingData && !showOverwriteConfirm) {
      setShowOverwriteConfirm(true);
      return;
    }

    // Filter data based on load mode
    let dataToLoad = validationResult.data;
    
    if (loadMode === 'compatible') {
      // Use only valid items (already filtered by deserializer)
      dataToLoad = validationResult.data;
    } else if (loadMode === 'force') {
      // Force load - use the data as-is (with invalid items already filtered)
      dataToLoad = validationResult.data;
    }

    onLoad(dataToLoad);
    onClose();
  }

  function renderVersionInfo() {
    if (!validationResult) return null;
    
    const { metadata } = validationResult.data?._raw || {};
    if (!metadata) return null;

    return (
      <div className="load-version-info" style={{
        padding: '8px 12px',
        background: 'var(--bg2)',
        borderRadius: 6,
        fontSize: 13,
        marginBottom: 12
      }}>
        <div>Project version: <strong>{metadata.appVersion || 'unknown'}</strong></div>
        <div>Format version: {metadata.formatVersion || 'unknown'}</div>
        <div>Saved: {metadata.exportedAt ? new Date(metadata.exportedAt).toLocaleString() : 'unknown'}</div>
      </div>
    );
  }

  function renderWarnings() {
    if (!validationResult || validationResult.warnings.length === 0) return null;

    return (
      <div className="load-warnings" style={{
        padding: 12,
        background: 'rgba(234, 179, 8, 0.1)',
        border: '1px solid var(--warning)',
        borderRadius: 8,
        marginBottom: 12
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--warning)' }}>
          ⚠️ Warnings
        </div>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
          {validationResult.warnings.map((warning, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{warning}</li>
          ))}
        </ul>
      </div>
    );
  }

  function renderErrors() {
    if (!validationResult || validationResult.errors.length === 0) return null;

    return (
      <div className="load-errors" style={{
        padding: 12,
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid var(--error)',
        borderRadius: 8,
        marginBottom: 12
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--error)' }}>
          ✕ Errors
        </div>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
          {validationResult.errors.map((err, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{err}</li>
          ))}
        </ul>
      </div>
    );
  }

  function renderInvalidItems() {
    if (!validationResult) return null;
    
    const { invalidItems } = validationResult;
    const hasInvalidItems = invalidItems.students.length > 0 ||
                           invalidItems.teachers.length > 0 ||
                           invalidItems.keepApart.length > 0 ||
                           invalidItems.keepTogether.length > 0;
    
    if (!hasInvalidItems) return null;

    return (
      <div className="load-invalid-items" style={{
        padding: 12,
        background: 'var(--bg2)',
        borderRadius: 8,
        marginBottom: 12,
        fontSize: 13
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          Invalid items found (will be skipped):
        </div>
        {invalidItems.students.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <strong>Students ({invalidItems.students.length}):</strong>
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              {invalidItems.students.slice(0, 3).map((item, i) => (
                <li key={i}>{item.reason}</li>
              ))}
              {invalidItems.students.length > 3 && (
                <li>...and {invalidItems.students.length - 3} more</li>
              )}
            </ul>
          </div>
        )}
        {invalidItems.teachers.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <strong>Teachers ({invalidItems.teachers.length}):</strong>
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              {invalidItems.teachers.slice(0, 3).map((item, i) => (
                <li key={i}>{item.reason}</li>
              ))}
              {invalidItems.teachers.length > 3 && (
                <li>...and {invalidItems.teachers.length - 3} more</li>
              )}
            </ul>
          </div>
        )}
        {(invalidItems.keepApart.length > 0 || invalidItems.keepTogether.length > 0) && (
          <div>
            <strong>Constraints:</strong>
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              {invalidItems.keepApart.length > 0 && (
                <li>{invalidItems.keepApart.length} keep-apart pairs</li>
              )}
              {invalidItems.keepTogether.length > 0 && (
                <li>{invalidItems.keepTogether.length} keep-together groups</li>
              )}
            </ul>
          </div>
        )}
      </div>
    );
  }

  function renderLoadOptions() {
    if (!validationResult || !validationResult.canLoad) return null;

    const hasInvalidItems = validationResult.invalidItems.students.length > 0 ||
                           validationResult.invalidItems.teachers.length > 0 ||
                           validationResult.invalidItems.keepApart.length > 0 ||
                           validationResult.invalidItems.keepTogether.length > 0;

    if (!hasInvalidItems && validationResult.warnings.length === 0) return null;

    return (
      <div className="load-options" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>How would you like to proceed?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{
            padding: 12,
            border: `2px solid ${loadMode === 'compatible' ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 8,
            cursor: 'pointer',
            background: loadMode === 'compatible' ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg1)'
          }}>
            <input
              type="radio"
              name="loadMode"
              value="compatible"
              checked={loadMode === 'compatible'}
              onChange={() => setLoadMode('compatible')}
              style={{ marginRight: 8 }}
            />
            <strong>Load compatible data only</strong>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4, marginLeft: 24 }}>
              Skip invalid students, teachers, and constraints. Safest option.
            </div>
          </label>
          
          {hasInvalidItems && (
            <label style={{
              padding: 12,
              border: `2px solid ${loadMode === 'force' ? 'var(--warning)' : 'var(--border)'}`,
              borderRadius: 8,
              cursor: 'pointer',
              background: loadMode === 'force' ? 'rgba(234, 179, 8, 0.05)' : 'var(--bg1)'
            }}>
              <input
                type="radio"
                name="loadMode"
                value="force"
                checked={loadMode === 'force'}
                onChange={() => setLoadMode('force')}
                style={{ marginRight: 8 }}
              />
              <strong>Force load all valid data</strong>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4, marginLeft: 24 }}>
                Load all valid items and skip invalid ones. May result in missing constraints.
              </div>
            </label>
          )}
          
          <label style={{
            padding: 12,
            border: `2px solid ${loadMode === null ? 'var(--error)' : 'var(--border)'}`,
            borderRadius: 8,
            cursor: 'pointer',
            background: loadMode === null ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg1)'
          }}>
            <input
              type="radio"
              name="loadMode"
              value="cancel"
              checked={loadMode === null}
              onChange={() => setLoadMode(null)}
              style={{ marginRight: 8 }}
            />
            <strong>Cancel and review file</strong>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4, marginLeft: 24 }}>
              Go back and check your project file before loading.
            </div>
          </label>
        </div>
      </div>
    );
  }

  function renderOverwriteConfirm() {
    return (
      <div className="load-overwrite-confirm" style={{
        padding: 16,
        background: 'rgba(234, 179, 8, 0.1)',
        border: '2px solid var(--warning)',
        borderRadius: 8,
        marginBottom: 12
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--warning)' }}>
          ⚠️ Overwrite existing data?
        </div>
        <p style={{ margin: '0 0 12px 0', fontSize: 14 }}>
          You currently have data loaded. Loading this project will replace all existing students, 
          classes, and settings. This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setShowOverwriteConfirm(false)}
          >
            Go back
          </button>
          <button 
            className="btn btn-danger btn-sm"
            onClick={handleLoad}
          >
            Yes, replace my data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div className="modal-title">Load Project</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          {!file && (
            <div
              className={`drop-zone ${dragOver ? 'drag-over' : ''} ${isLoading ? 'loading' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isLoading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              
              {isLoading ? (
                <div className="drop-zone-content">
                  <div className="drop-zone-icon">⏳</div>
                  <div>Reading project file...</div>
                </div>
              ) : (
                <div className="drop-zone-content">
                  <div className="drop-zone-icon">📁</div>
                  <div className="drop-zone-title">Drop a project file or click to browse</div>
                  <div className="drop-zone-hint">Supports .json project files</div>
                </div>
              )}
            </div>
          )}
          
          {file && !isLoading && (
            <div style={{ 
              padding: 12, 
              background: 'var(--bg2)', 
              borderRadius: 8, 
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>📄</span>
                <span style={{ fontWeight: 500 }}>{file.name}</span>
              </div>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setFile(null);
                  setValidationResult(null);
                  setLoadMode(null);
                  setShowOverwriteConfirm(false);
                  setError('');
                }}
              >
                Choose different file
              </button>
            </div>
          )}
          
          {error && (
            <div className="load-error" style={{
              padding: 12,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--error)',
              borderRadius: 8,
              color: 'var(--error)',
              marginBottom: 12
            }}>
              {error}
            </div>
          )}
          
          {validationResult && renderVersionInfo()}
          {validationResult && renderErrors()}
          {validationResult && renderWarnings()}
          {validationResult && renderInvalidItems()}
          {validationResult && renderLoadOptions()}
          {showOverwriteConfirm && renderOverwriteConfirm()}
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {validationResult?.canLoad && !showOverwriteConfirm && (
            <button 
              className="btn btn-primary" 
              onClick={handleLoad}
              disabled={loadMode === null}
            >
              Load Project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
