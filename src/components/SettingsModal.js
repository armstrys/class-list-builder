/**
 * SettingsModal - Configure numeric and flag criteria
 * 
 * Uses contexts:
 * - useCriteria: Criteria configuration
 * 
 * @param {Object} props
 * @param {Function} props.onSave - Save callback
 * @param {Function} props.onClose - Close callback
 * @param {boolean} props.hasStudentData - Whether students exist
 * @param {Function} props.onExportStudents - Export students callback
 * @param {Function} props.onClearStudents - Clear students callback
 */
function SettingsModal({
  onSave,
  onClose,
  hasStudentData,
  onExportStudents,
  onClearStudents
}) {
  // Get criteria from context
  const { numericCriteria, flagCriteria } = useCriteriaExport();
  const [activeTab, setActiveTab] = useState('numeric');
  const [numCriteria, setNumCriteria] = useState(numericCriteria);
  const [flagCriteriaState, setFlagCriteriaState] = useState(flagCriteria);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [configConflict, setConfigConflict] = useState(null);

  function validateWeight(val) {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }

  function validateShort(val) {
    if (!val || !val.trim()) return false;
    if (val.includes(',')) return false;
    return true;
  }

  function updateNumCriteria(index, field, value) {
    setNumCriteria(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function updateFlagCriteria(index, field, value) {
    setFlagCriteriaState(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addNumericCriterion() {
    setNumCriteria(prev => [...prev, {
      key: '',
      label: '',
      short: '',
      weight: 1.0
    }]);
  }

  function addFlagCriterion() {
    setFlagCriteriaState(prev => [...prev, {
      key: '',
      label: '',
      short: '',
      weight: 1.5
    }]);
  }

  function requestRemoveNum(index) {
    if (hasStudentData) {
      setConfirmRemove({ type: 'numeric', index, label: numCriteria[index].label });
    } else {
      removeNumCriterion(index);
    }
  }

  function requestRemoveFlag(index) {
    if (hasStudentData) {
      setConfirmRemove({ type: 'flag', index, label: flagCriteriaState[index].label });
    } else {
      removeFlagCriterion(index);
    }
  }

  function removeNumCriterion(index) {
    setNumCriteria(prev => prev.filter((_, i) => i !== index));
    setConfirmRemove(null);
  }

  function removeFlagCriterion(index) {
    setFlagCriteriaState(prev => prev.filter((_, i) => i !== index));
    setConfirmRemove(null);
  }

  function handleSave() {
    setError('');

    // Validate numeric criteria
    for (const c of numCriteria) {
      if (!c.label.trim()) {
        setError('All criteria must have a label');
        return;
      }
      if (!validateShort(c.short)) {
        setError(`Invalid short name for "${c.label}". Short name is required and cannot contain commas.`);
        return;
      }
      if (!validateWeight(c.weight)) {
        setError(`Invalid weight for "${c.label}". Weight must be a positive number.`);
        return;
      }
    }

    // Validate flag criteria
    for (const c of flagCriteriaState) {
      if (!c.label.trim()) {
        setError('All criteria must have a label');
        return;
      }
      if (!validateShort(c.short)) {
        setError(`Invalid short name for "${c.label}". Short name is required and cannot contain commas.`);
        return;
      }
      if (!validateWeight(c.weight)) {
        setError(`Invalid weight for "${c.label}". Weight must be a positive number.`);
        return;
      }
    }

    // Check for duplicate keys
    const allKeys = [...numCriteria.map(c => generateKeyFromLabel(c.label)), ...flagCriteriaState.map(c => generateKeyFromLabel(c.label))];
    const uniqueKeys = new Set(allKeys);
    if (uniqueKeys.size !== allKeys.length) {
      setError('Duplicate field labels are not allowed. Labels must be unique.');
      return;
    }

    // Finalize criteria with generated keys
    const finalNumCriteria = numCriteria.map(c => ({
      ...c,
      key: generateKeyFromLabel(c.label),
      weight: parseFloat(c.weight),
    }));

    const finalFlagCriteria = flagCriteriaState.map(c => ({
      ...c,
      key: generateKeyFromLabel(c.label),
      weight: parseFloat(c.weight),
    }));

    onSave(finalNumCriteria, finalFlagCriteria);
    onClose();
  }

  function exportConfig() {
    const config = {
      version: 1,
      numericCriteria: numCriteria.map(c => ({ ...c, key: generateKeyFromLabel(c.label) })),
      flagCriteria: flagCriteriaState.map(c => ({ ...c, key: generateKeyFromLabel(c.label) })),
    };
    triggerDownload(JSON.stringify(config, null, 2), 'class-optimizer-config.json', 'application/json');
  }

  function importConfig(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        if (!config.numericCriteria || !config.flagCriteria) {
          setError('Invalid config file: missing criteria arrays');
          return;
        }
        if (hasStudentData) {
          const existingNumKeys = new Set(numericCriteria.map(c => c.key));
          const existingFlagKeys = new Set(flagCriteria.map(c => c.key));
          const newNumKeys = new Set(config.numericCriteria.map(c => c.key));
          const newFlagKeys = new Set(config.flagCriteria.map(c => c.key));
          const keysChanged =
            [...existingNumKeys].some(k => !newNumKeys.has(k)) ||
            [...newNumKeys].some(k => !existingNumKeys.has(k)) ||
            [...existingFlagKeys].some(k => !newFlagKeys.has(k)) ||
            [...newFlagKeys].some(k => !existingFlagKeys.has(k));
          if (keysChanged) {
            // Show helpful modal instead of just an error
            setConfigConflict({
              config,
              message: 'The config file has different fields than your current setup. Student data is incompatible with the new config.'
            });
            return;
          }
        }
        setNumCriteria(config.numericCriteria);
        setFlagCriteriaState(config.flagCriteria);
      } catch (err) {
        setError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }

  function handleExportOnly() {
    if (onExportStudents) onExportStudents();
    // Don't close modal or clear - let user decide next step
  }

  function handleClearAndApply() {
    if (onClearStudents) onClearStudents();
    setConfigConflict(null);
    // Apply the config after clearing
    if (configConflict?.config) {
      setNumCriteria(configConflict.config.numericCriteria);
      setFlagCriteriaState(configConflict.config.flagCriteria);
    }
  }

  function resetToDefaults() {
    setNumCriteria(DEFAULT_NUMERIC_CRITERIA.map(c => ({ ...c })));
    setFlagCriteriaState(DEFAULT_FLAG_CRITERIA.map(c => ({ ...c })));
  }

  function clearSavedSettings() {
    localStorage.removeItem(STORAGE_KEYS.NUMERIC_CRITERIA);
    localStorage.removeItem(STORAGE_KEYS.FLAG_CRITERIA);
    setNumCriteria(DEFAULT_NUMERIC_CRITERIA.map(c => ({ ...c })));
    setFlagCriteriaState(DEFAULT_FLAG_CRITERIA.map(c => ({ ...c })));
    setConfirmClear(false);
  }

  const fileInputRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !confirmRemove && !confirmClear) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmRemove, confirmClear]);

  const footer = (
    <>
      <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={handleSave}>Save Settings</button>
    </>
  );

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title="Criteria Settings"
        size="xl"
        footer={footer}
        closeOnOverlayClick={!confirmRemove && !confirmClear}
      >
      <div>
          {hasStudentData && (
            <div style={{
              background: 'var(--amber-light)',
              border: '1px solid var(--amber)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: 13,
              color: 'var(--text)'
            }}>
              ⚠️ Student data exists. Removing fields with data will require confirmation.
            </div>
          )}

          <div className="config-actions">
            <button className="btn btn-secondary btn-sm" onClick={exportConfig}>⬇ Save Config</button>
            <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>⬆ Import Config</button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) importConfig(e.target.files[0]); e.target.value = ''; }}
            />
            <button className="btn btn-ghost btn-sm" onClick={resetToDefaults}>Reset to Defaults</button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmClear(true)}>🗑 Clear Cache</button>
          </div>

          <div className="settings-tabs">
            <button
              className={`settings-tab ${activeTab === 'numeric' ? 'active' : ''}`}
              onClick={() => setActiveTab('numeric')}
            >
              Numeric Fields ({numCriteria.length})
            </button>
            <button
              className={`settings-tab ${activeTab === 'flags' ? 'active' : ''}`}
              onClick={() => setActiveTab('flags')}
            >
              Flag Fields ({flagCriteriaState.length})
            </button>
          </div>

          {activeTab === 'numeric' && (
            <div className="settings-section">
              <div className="criteria-header">
                <div>Display Name</div>
                <div>Short Name</div>
                <div>Weight</div>
                <div></div>
              </div>
              <div className="criteria-list">
                {numCriteria.map((c, i) => (
                  <div key={i} className="criteria-item">
                    <input
                      className="form-input"
                      placeholder="Label (e.g., Reading Score)"
                      value={c.label}
                      onChange={e => updateNumCriteria(i, 'label', e.target.value)}
                    />
                    <input
                      className="form-input"
                      placeholder="Short (e.g., Read)"
                      value={c.short}
                      onChange={e => updateNumCriteria(i, 'short', e.target.value)}
                    />
                    <input
                      className="form-input"
                      placeholder="Weight"
                      value={c.weight}
                      onChange={e => updateNumCriteria(i, 'weight', e.target.value)}
                    />
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => requestRemoveNum(i)}
                      disabled={numCriteria.length <= 1}
                      title={numCriteria.length <= 1 ? 'Must have at least one numeric field' : 'Remove'}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={addNumericCriterion} style={{ marginTop: 12 }}>
                + Add Numeric Field
              </button>
            </div>
          )}

          {activeTab === 'flags' && (
            <div className="settings-section">
              <div className="criteria-header">
                <div>Display Name</div>
                <div>Short Name</div>
                <div>Weight</div>
                <div></div>
              </div>
              <div className="criteria-list">
                {flagCriteriaState.map((c, i) => (
                  <div key={i} className="criteria-item">
                    <input
                      className="form-input"
                      placeholder="Label (e.g., Behavior)"
                      value={c.label}
                      onChange={e => updateFlagCriteria(i, 'label', e.target.value)}
                    />
                    <input
                      className="form-input"
                      placeholder="Short (e.g., BEH)"
                      value={c.short}
                      onChange={e => updateFlagCriteria(i, 'short', e.target.value)}
                    />
                    <input
                      className="form-input"
                      placeholder="Weight"
                      value={c.weight}
                      onChange={e => updateFlagCriteria(i, 'weight', e.target.value)}
                    />
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => requestRemoveFlag(i)}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={addFlagCriterion} style={{ marginTop: 12 }}>
                + Add Flag Field
              </button>
            </div>
          )}

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>
              {error}
            </div>
          )}
      </Modal>

      <Modal
        isOpen={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="Confirm Removal"
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmRemove(null)}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={() => confirmRemove.type === 'numeric'
                ? removeNumCriterion(confirmRemove.index)
                : removeFlagCriterion(confirmRemove.index)
              }
            >
              Remove Field
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          Student data exists. Removing "{confirmRemove?.label}" will delete this data from all student records.
          This cannot be undone.
        </p>
      </Modal>

      <Modal
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear Saved Settings?"
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmClear(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={clearSavedSettings}>Reset to Defaults</button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          This will reset your criteria configuration to factory defaults and clear the saved cache.
          Click Save Settings afterward to apply the defaults.
        </p>
      </Modal>

      <Modal
        isOpen={!!configConflict}
        onClose={() => setConfigConflict(null)}
        title="⚠️ Config Import Blocked"
        size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setConfigConflict(null)}>Cancel</button>
            <button className="btn btn-secondary" onClick={handleExportOnly}>⬇ Export Students</button>
            <button className="btn btn-danger" onClick={handleClearAndApply}>Clear & Apply Config</button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>
          {configConflict?.message}
        </p>
        <div style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          marginBottom: 16,
          fontSize: 13
        }}>
          <strong>What you can do:</strong>
          <ol style={{ margin: '8px 0 0 16px', padding: 0, lineHeight: 1.6 }}>
            <li><strong>Export</strong> your current students as CSV (optional backup)</li>
            <li><strong>Clear</strong> student data to remove the conflict</li>
            <li>The new config will be applied automatically</li>
          </ol>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>
          Tip: You can re-import your student data later if the fields match the new config.
        </p>
      </Modal>
    </>
  );
}
