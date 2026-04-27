function SetupPage({
  students,
  setStudents,
  teachers,
  setTeachers,
  onOptimize,
  numericCriteria,
  flagCriteria,
  onOpenSettings,
  keepApart,
  onAddKeepApart,
  onRemoveKeepApart,
  keepTogether,
  onAddKeepTogether,
  onRemoveKeepTogether,
  keepOutOfClass,
  onAddKeepOutOfClass,
  onRemoveKeepOutOfClass,
  onRemoveStudentConstraints,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showSampleDialog, setShowSampleDialog] = useState(false);
  const [showConstraintModal, setShowConstraintModal] = useState(false);
  const [sampleCount, setSampleCount] = useState(27);
  const [numTeachers, setNumTeachers] = useState(String(teachers.length || 3));
  const [idFilter, setIdFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');

  // Filter students by ID and name
  const filteredStudents = students.filter(s => {
    const matchesId = idFilter === '' || s.id.toLowerCase().includes(idFilter.toLowerCase());
    const matchesName = nameFilter === '' || s.name.toLowerCase().includes(nameFilter.toLowerCase());
    return matchesId && matchesName;
  });

  function getDefaultClassName(index) {
    // Convert index to Excel-style column letters (0 -> A, 25 -> Z, 26 -> AA, 27 -> AB, etc.)
    let n = index;
    let result = '';
    do {
      result = String.fromCharCode(65 + (n % 26)) + result;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return `Class ${result}`;
  }

  function syncTeachers(val) {
    setNumTeachers(val);
    const n = Math.max(2, Math.min(1000, parseInt(val) || 0));
    if (!parseInt(val) || parseInt(val) < 2) return;
    const next = [...teachers];
    while (next.length < n) next.push({ id: 'T' + (next.length + 1), name: getDefaultClassName(next.length) });
    setTeachers(next.slice(0, n));
  }

  function handleAddStudent(s) {
    setStudents(prev => [...prev, s]);
  }
  function handleEditStudent(s) {
    setStudents(prev => prev.map(x => x.id === s.id ? s : x));
    setEditingStudent(null);
  }
  function handleDeleteStudent(id) {
    setStudents(prev => prev.filter(s => s.id !== id));
    if (onRemoveStudentConstraints) {
      onRemoveStudentConstraints(id);
    }
  }

  const canOptimize = students.length >= teachers.length && teachers.length >= 2;

  function saveStudentsCSV() {
    if (students.length === 0) return;
    const csv = exportStudentsToCSV(students, numericCriteria, flagCriteria, keepApart, keepTogether);
    triggerDownload(csv, 'students.csv', 'text/csv');
  }

  function clearAllStudents() {
    if (students.length === 0) return;
    const confirmClear = window.confirm(`Clear all ${students.length} students? This cannot be undone.`);
    if (confirmClear) {
      setStudents([]);
      // Clear constraints when clearing students
      if (onRemoveStudentConstraints) {
        students.forEach(s => onRemoveStudentConstraints(s.id));
      }
    }
  }

  return (
    <>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div className="setup-layout">
          {/* Teachers */}
          <div className="card" style={{ alignSelf: 'start' }}>
            <div className="panel-title">Teachers / Classes</div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Number of classes</label>
              <input
                className="form-input"
                type="number" min="2" max="1000"
                value={numTeachers}
                onChange={e => syncTeachers(e.target.value)}
              />
            </div>
            <div className="teacher-list">
              {teachers.map((t, i) => (
                <div key={t.id} className="teacher-item">
                  <div className="teacher-num">{i + 1}</div>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    value={t.name}
                    placeholder={getDefaultClassName(i)}
                    onChange={e => setTeachers(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Students */}
          <div className="card students-card">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 8 }}>
              <div className="panel-title" style={{ margin: 0 }}>
                Students
              </div>
              <span className="tag">{students.length}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>⬆ Import CSV</button>
                {students.length > 0 && (
                  <button className="btn btn-secondary btn-sm" onClick={saveStudentsCSV}>⬇ Save Students</button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => setShowSampleDialog(true)}>Sample Data</button>
                {students.length > 0 && (
                  <button className="btn btn-danger btn-sm" onClick={clearAllStudents}>Clear All</button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => setShowConstraintModal(true)}>
                  🔗 Constraints {(keepApart.length + keepTogether.length) > 0 && `(${keepApart.length + keepTogether.length})`}
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Add Student</button>
              </div>
            </div>

            {students.length === 0 ? (
              <div className="empty-state">
                <div className="icon">👩‍🎓</div>
                <div>No students yet — import a CSV or add sample data to get started.</div>
                <div style={{ marginTop: 16 }}>
                  <button className="btn btn-secondary" onClick={onOpenSettings}>⚙️ Configure Criteria First</button>
                </div>
              </div>
            ) : (
              <div className="students-table-wrap" style={{ maxHeight: 'calc(100vh - 260px)' }}>
                {/* Filter row */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 12, padding: '8px 0' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Filter by ID..."
                    value={idFilter}
                    onChange={e => setIdFilter(e.target.value)}
                    style={{ flex: 1, maxWidth: 200 }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Filter by name..."
                    value={nameFilter}
                    onChange={e => setNameFilter(e.target.value)}
                    style={{ flex: 2 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'center' }}>
                    Showing {filteredStudents.length} of {students.length}
                  </span>
                </div>
                <table className="students-table">
                  <thead>
                    <tr>
                      <th className="col-id" style={{ fontSize: 11, width: 80 }}>ID</th>
                      <th className="col-name">Name</th>
                      <th>G</th>
                      {numericCriteria.map(c => <th key={c.key} className="col-num" title={c.label}>{c.short}</th>)}
                      {flagCriteria.map(c => <th key={c.key} className="col-check" title={c.label}>{c.short}</th>)}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(s => (
                      <tr key={s.id}>
                        <td className="col-id" style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{s.id}</td>
                        <td className="col-name">{s.name}</td>
                        <td><span className={`badge badge-${s.gender}`}>{s.gender}</span></td>
                        {numericCriteria.map(c => <td key={c.key} className="col-num">{s[c.key] || 0}</td>)}
                        {flagCriteria.map(c => (
                          <td key={c.key} className="col-check">
                            {s[c.key] && <span className="badge" style={{ background: generateColor(c.key).bg, color: generateColor(c.key).fg }}>✓</span>}
                          </td>
                        ))}
                        <td style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingStudent(s)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteStudent(s.id)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="setup-bottom">
        <div className="setup-bottom-left">
          {!canOptimize && students.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              Need at least {teachers.length} students and 2+ teachers
            </span>
          )}
        </div>
        <button className="btn btn-secondary" onClick={() => setShowSampleDialog(true)}>
          Load Sample Data
        </button>
        <button className="btn btn-primary" disabled={!canOptimize} onClick={onOptimize}>
          Optimize Classes →
        </button>
      </div>

      {showForm && (
        <StudentFormModal
          student={null}
          onSave={handleAddStudent}
          onClose={() => setShowForm(false)}
          numericCriteria={numericCriteria}
          flagCriteria={flagCriteria}
        />
      )}
      {editingStudent && (
        <StudentFormModal
          student={editingStudent}
          onSave={handleEditStudent}
          onClose={() => setEditingStudent(null)}
          numericCriteria={numericCriteria}
          flagCriteria={flagCriteria}
        />
      )}
      {showSampleDialog && (
        <SampleDataDialog
          defaultCount={sampleCount}
          onGenerate={(n) => {
            setSampleCount(n);
            setStudents(generateSampleStudents(n, numericCriteria, flagCriteria));
            setShowSampleDialog(false);
          }}
          onClose={() => setShowSampleDialog(false)}
        />
      )}
      {showImport && (
        <ImportModal
          onImport={(ss, importedKeepApart, importedKeepTogether) => {
            setStudents(prev => [...prev, ...ss]);
            if (importedKeepApart && importedKeepApart.length > 0) {
              importedKeepApart.forEach(pair => onAddKeepApart(pair[0], pair[1]));
            }
            if (importedKeepTogether && importedKeepTogether.length > 0) {
              importedKeepTogether.forEach(group => onAddKeepTogether(group));
            }
          }}
          onClose={() => setShowImport(false)}
          numericCriteria={numericCriteria}
          flagCriteria={flagCriteria}
          students={students}
          onClearAll={clearAllStudents}
        />
      )}
      {showConstraintModal && (
        <ConstraintManager
          students={students}
          keepApart={keepApart}
          onAddKeepApart={onAddKeepApart}
          onRemoveKeepApart={onRemoveKeepApart}
          keepTogether={keepTogether}
          onAddKeepTogether={onAddKeepTogether}
          onRemoveKeepTogether={onRemoveKeepTogether}
          keepOutOfClass={keepOutOfClass}
          teachers={teachers}
          onAddKeepOutOfClass={onAddKeepOutOfClass}
          onRemoveKeepOutOfClass={onRemoveKeepOutOfClass}
          onClose={() => setShowConstraintModal(false)}
        />
      )}
    </>
  );
}
