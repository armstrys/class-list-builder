function ConstraintManager({
  students,
  keepApart,
  onAddKeepApart,
  onRemoveKeepApart,
  keepTogether,
  onAddKeepTogether,
  onRemoveKeepTogether,
  keepOutOfClass,
  teachers,
  onAddKeepOutOfClass,
  onRemoveKeepOutOfClass,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('apart'); // 'apart' | 'together' | 'outofclass'
  const [selectedIds, setSelectedIds] = useState([]);
  const [filter, setFilter] = useState('');

  // Keep Out of Class form state
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedClassIndex, setSelectedClassIndex] = useState('');
  const [studentFilter, setStudentFilter] = useState('');

  const studentById = Object.fromEntries(students.map(s => [s.id, s]));

  // Filter students by name
  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(filter.toLowerCase())
  );

  // Get apart constraint pairs with student info
  const apartConstraints = keepApart.map(([id1, id2]) => ({
    id1,
    id2,
    name1: studentById[id1]?.name || id1,
    name2: studentById[id2]?.name || id2,
  }));

  // Get together constraint groups with student info
  const togetherConstraints = keepTogether.map((group, idx) => ({
    idx,
    studentIds: group,
    names: group.map(id => studentById[id]?.name || id),
  }));

  // Get keep-out-of-class constraints with student and class info
  const outOfClassConstraints = keepOutOfClass.map((c, idx) => ({
    idx,
    studentId: c.studentId,
    classIndex: c.classIndex,
    studentName: studentById[c.studentId]?.name || c.studentId,
    teacherName: teachers[c.classIndex]?.name || `Class ${c.classIndex + 1}`,
  }));

  // Build adjacency list for keep-apart
  const apartAdj = {};
  students.forEach(s => { apartAdj[s.id] = []; });
  keepApart.forEach(([id1, id2]) => {
    if (apartAdj[id1]) apartAdj[id1].push(id2);
    if (apartAdj[id2]) apartAdj[id2].push(id1);
  });

  // Build set of students in keep-together groups
  const togetherStudentSet = new Set();
  keepTogether.forEach(group => {
    group.forEach(id => togetherStudentSet.add(id));
  });

  function toggleSelection(id) {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      return [...prev, id];
    });
  }

  function handleAddApartConstraint() {
    if (selectedIds.length >= 2) {
      // Add pairwise constraints for all selected students
      for (let i = 0; i < selectedIds.length; i++) {
        for (let j = i + 1; j < selectedIds.length; j++) {
          onAddKeepApart(selectedIds[i], selectedIds[j]);
        }
      }
      setSelectedIds([]);
    }
  }

  function handleAddTogetherConstraint() {
    if (selectedIds.length >= 2) {
      onAddKeepTogether(selectedIds);
      setSelectedIds([]);
    }
  }

  function handleRemoveApartConstraint(id1, id2) {
    onRemoveKeepApart(id1, id2);
  }

  function handleRemoveTogetherConstraint(idx) {
    onRemoveKeepTogether(idx);
  }

  function handleAddOutOfClassConstraint() {
    if (selectedStudentId && selectedClassIndex !== '') {
      onAddKeepOutOfClass(selectedStudentId, parseInt(selectedClassIndex, 10));
      setSelectedStudentId('');
      setSelectedClassIndex('');
    }
  }

  function handleRemoveOutOfClassConstraint(studentId, classIndex) {
    onRemoveKeepOutOfClass(studentId, classIndex);
  }

  // Get related students for the selected group (apart mode only)
  function getSelectedGroupInfo() {
    if (activeTab !== 'apart' || selectedIds.length === 0) return null;
    
    const selectedSet = new Set(selectedIds);
    const related = new Set();
    
    selectedIds.forEach(id => {
      apartAdj[id].forEach(neighbor => {
        if (!selectedSet.has(neighbor)) {
          related.add(neighbor);
        }
      });
    });
    
    return {
      selected: selectedIds.map(id => studentById[id]?.name || id),
      related: Array.from(related).map(id => studentById[id]?.name || id),
    };
  }

  const groupInfo = getSelectedGroupInfo();

  // Count total constraints
  const totalConstraints = keepApart.length + keepTogether.length + keepOutOfClass.length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, width: '90%' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Student Constraints</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}>
            <button
              onClick={() => { setActiveTab('apart'); setSelectedIds([]); setFilter(''); }}
              style={{
                padding: '12px 20px',
                border: 'none',
                background: activeTab === 'apart' ? 'var(--bg)' : 'transparent',
                borderBottom: activeTab === 'apart' ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === 'apart' ? 'var(--accent)' : 'var(--text2)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Keep Apart
              {keepApart.length > 0 && (
                <span className="badge" style={{ background: 'var(--danger)', color: 'white', fontSize: 10 }}>
                  {keepApart.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('together'); setSelectedIds([]); setFilter(''); }}
              style={{
                padding: '12px 20px',
                border: 'none',
                background: activeTab === 'together' ? 'var(--bg)' : 'transparent',
                borderBottom: activeTab === 'together' ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === 'together' ? 'var(--accent)' : 'var(--text2)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Keep Together
              {keepTogether.length > 0 && (
                <span className="badge" style={{ background: 'var(--accent)', color: 'white', fontSize: 10 }}>
                  {keepTogether.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('outofclass'); setSelectedIds([]); setFilter(''); }}
              style={{
                padding: '12px 20px',
                border: 'none',
                background: activeTab === 'outofclass' ? 'var(--bg)' : 'transparent',
                borderBottom: activeTab === 'outofclass' ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === 'outofclass' ? 'var(--accent)' : 'var(--text2)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Keep Out of Class
              {keepOutOfClass.length > 0 && (
                <span className="badge" style={{ background: 'var(--warning)', color: 'white', fontSize: 10 }}>
                  {keepOutOfClass.length}
                </span>
              )}
            </button>
          </div>

          <div style={{ padding: 20 }}>
            {activeTab === 'apart' && (
              <>
                {/* Keep Apart Existing Constraints */}
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 500 }}>
                    Active Keep-Apart Constraints ({apartConstraints.length})
                  </h4>
                  {apartConstraints.length === 0 ? (
                    <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>
                      No keep-apart constraints set yet. These students will be placed in different classes.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {apartConstraints.map((c, idx) => (
                        <div key={idx} className="constraint-item" style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '8px 12px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="badge" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
                              {c.name1}
                            </span>
                            <span style={{ color: 'var(--text3)' }}>↔</span>
                            <span className="badge" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
                              {c.name2}
                            </span>
                            <span style={{ 
                              marginLeft: 'auto', 
                              fontSize: 11, 
                              color: 'var(--text3)',
                              fontStyle: 'italic'
                            }}>
                              {apartAdj[c.id1].length > 1 && `${apartAdj[c.id1].length - 1} other constraints`}
                            </span>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleRemoveApartConstraint(c.id1, c.id2)}
                              title="Remove this constraint"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Keep Apart Add New */}
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 500 }}>
                    Add Keep-Apart Constraint
                  </h4>
                  <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text3)' }}>
                    Select 2+ students. Each pair will be kept in different classes.
                  </p>

                  <input
                    type="text"
                    className="form-input"
                    placeholder="Filter students by name..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    style={{ marginBottom: 12 }}
                  />

                  <div style={{
                    maxHeight: 200,
                    overflow: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: 12,
                  }}>
                    {filteredStudents.length === 0 ? (
                      <div style={{ padding: 16, color: 'var(--text3)', textAlign: 'center' }}>
                        No students match your filter.
                      </div>
                    ) : (
                      filteredStudents.map(s => (
                        <div
                          key={s.id}
                          onClick={() => toggleSelection(s.id)}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            background: selectedIds.includes(s.id) ? 'var(--accent)' : 'transparent',
                            color: selectedIds.includes(s.id) ? 'white' : 'var(--text)',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(s.id)}
                            onChange={() => {}}
                            style={{ pointerEvents: 'none' }}
                          />
                          <span>{s.name}</span>
                          {apartAdj[s.id].length > 0 && (
                            <span style={{ 
                              fontSize: 10, 
                              marginLeft: 8,
                              opacity: 0.7 
                            }}>
                              ({apartAdj[s.id].length} apart constraints)
                            </span>
                          )}
                          <span className={`badge badge-${s.gender}`} style={{ marginLeft: 'auto' }}>
                            {s.gender}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Selection summary */}
                  {selectedIds.length > 0 && (
                    <div style={{ 
                      marginBottom: 12, 
                      padding: 12, 
                      background: 'var(--surface)', 
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ fontSize: 13, marginBottom: 8 }}>
                        <strong>Selected ({selectedIds.length}):</strong>{' '}
                        {selectedIds.map(id => studentById[id]?.name).join(', ')}
                      </div>
                      {selectedIds.length >= 2 && (
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                          Will create {Math.floor(selectedIds.length * (selectedIds.length - 1) / 2)} pairwise constraints
                        </div>
                      )}
                      {groupInfo && groupInfo.related.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 8 }}>
                          Note: Some selected students already have apart constraints with: {groupInfo.related.join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
                    {selectedIds.length > 0 && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setSelectedIds([])}
                      >
                        Clear Selection
                      </button>
                    )}
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={selectedIds.length < 2}
                      onClick={handleAddApartConstraint}
                    >
                      Add {selectedIds.length >= 2 ? Math.floor(selectedIds.length * (selectedIds.length - 1) / 2) : 0} Constraint{selectedIds.length > 3 ? 's' : ''}
                    </button>
                  </div>
                </div>
              </>
            )}
            {activeTab === 'together' && (
              <>
                {/* Keep Together Existing Constraints */}
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 500 }}>
                    Active Keep-Together Groups ({togetherConstraints.length})
                  </h4>
                  {togetherConstraints.length === 0 ? (
                    <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>
                      No keep-together constraints set yet. These students will be placed in the same class.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {togetherConstraints.map((c) => (
                        <div key={c.idx} className="constraint-item" style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '8px 12px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, marginRight: 8 }}>
                              Group {c.idx + 1}:
                            </span>
                            {c.names.map((name, i) => (
                              <span key={i}>
                                <span className="badge" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
                                  {name}
                                </span>
                                {i < c.names.length - 1 && (
                                  <span style={{ color: 'var(--text3)', margin: '0 4px' }}>+</span>
                                )}
                              </span>
                            ))}
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleRemoveTogetherConstraint(c.idx)}
                              title="Remove this group"
                              style={{ marginLeft: 'auto' }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Keep Together Add New */}
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 500 }}>
                    Add Keep-Together Group
                  </h4>
                  <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text3)' }}>
                    Select 2+ students. They will be placed in the same class.
                  </p>

                  <input
                    type="text"
                    className="form-input"
                    placeholder="Filter students by name..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    style={{ marginBottom: 12 }}
                  />

                  <div style={{
                    maxHeight: 200,
                    overflow: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: 12,
                  }}>
                    {filteredStudents.length === 0 ? (
                      <div style={{ padding: 16, color: 'var(--text3)', textAlign: 'center' }}>
                        No students match your filter.
                      </div>
                    ) : (
                      filteredStudents.map(s => (
                        <div
                          key={s.id}
                          onClick={() => toggleSelection(s.id)}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            background: selectedIds.includes(s.id) ? 'var(--accent)' : 'transparent',
                            color: selectedIds.includes(s.id) ? 'white' : 'var(--text)',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(s.id)}
                            onChange={() => {}}
                            style={{ pointerEvents: 'none' }}
                          />
                          <span>{s.name}</span>
                          {togetherStudentSet.has(s.id) && (
                            <span style={{ 
                              fontSize: 10, 
                              marginLeft: 8,
                              opacity: 0.7,
                              color: 'var(--accent)'
                            }}>
                              (in group)
                            </span>
                          )}
                          <span className={`badge badge-${s.gender}`} style={{ marginLeft: 'auto' }}>
                            {s.gender}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Selection summary */}
                  {selectedIds.length > 0 && (
                    <div style={{ 
                      marginBottom: 12, 
                      padding: 12, 
                      background: 'var(--surface)', 
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ fontSize: 13, marginBottom: 8 }}>
                        <strong>Selected ({selectedIds.length}):</strong>{' '}
                        {selectedIds.map(id => studentById[id]?.name).join(', ')}
                      </div>
                      {selectedIds.length >= 2 && (
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                          Will create 1 keep-together group
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
                    {selectedIds.length > 0 && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setSelectedIds([])}
                      >
                        Clear Selection
                      </button>
                    )}
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={selectedIds.length < 2}
                      onClick={handleAddTogetherConstraint}
                    >
                      Add Group
                    </button>
                  </div>
                </div>
              </>
            )}
            {activeTab === 'outofclass' && (
              <>
                {/* Keep Out of Class Existing Constraints */}
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 500 }}>
                    Active Keep-Out-of-Class Constraints ({outOfClassConstraints.length})
                  </h4>
                  {outOfClassConstraints.length === 0 ? (
                    <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>
                      No keep-out-of-class constraints set yet. These students will be prevented from being assigned to specific classes.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {outOfClassConstraints.map((c) => (
                        <div key={c.idx} className="constraint-item" style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '8px 12px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="badge" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
                              {c.studentName}
                            </span>
                            <span style={{ color: 'var(--text3)' }}>→</span>
                            <span className="badge" style={{ background: 'var(--warning)', color: 'white' }}>
                              {c.teacherName}
                            </span>
                            <span style={{
                              marginLeft: 'auto',
                              fontSize: 11,
                              color: 'var(--text3)',
                              fontStyle: 'italic'
                            }}>
                              blocked
                            </span>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleRemoveOutOfClassConstraint(c.studentId, c.classIndex)}
                              title="Remove this constraint"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Keep Out of Class Add New */}
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 500 }}>
                    Add Keep-Out-of-Class Constraint
                  </h4>
                  <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text3)' }}>
                    Select a student and a class to prevent them from being assigned to that class.
                  </p>

                  {/* Student filter and select */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'var(--text2)' }}>
                      Filter Students
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Filter students by name..."
                      value={studentFilter}
                      onChange={e => setStudentFilter(e.target.value)}
                      style={{ marginBottom: 8 }}
                    />

                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'var(--text2)' }}>
                      Select Student
                    </label>
                    <select
                      className="form-select"
                      value={selectedStudentId}
                      onChange={e => setSelectedStudentId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: 14,
                      }}
                    >
                      <option value="">-- Select a student --</option>
                      {students
                        .filter(s => s.name.toLowerCase().includes(studentFilter.toLowerCase()))
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                    {studentFilter && students.filter(s => s.name.toLowerCase().includes(studentFilter.toLowerCase())).length === 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                        No students match this filter
                      </div>
                    )}
                  </div>

                  {/* Class select */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'var(--text2)' }}>
                      Select Class to Block
                    </label>
                    <select
                      className="form-select"
                      value={selectedClassIndex}
                      onChange={e => setSelectedClassIndex(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: 14,
                      }}
                    >
                      <option value="">-- Select a class --</option>
                      {teachers.map((t, idx) => (
                        <option key={idx} value={idx}>
                          {t.name} (Class {idx + 1})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selected summary */}
                  {selectedStudentId && selectedClassIndex !== '' && (
                    <div style={{
                      marginBottom: 12,
                      padding: 12,
                      background: 'var(--surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ fontSize: 13 }}>
                        <strong>Constraint to add:</strong>
                      </div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        <span className="badge" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
                          {studentById[selectedStudentId]?.name}
                        </span>
                        <span style={{ color: 'var(--text3)', margin: '0 8px' }}>will be kept out of</span>
                        <span className="badge" style={{ background: 'var(--warning)', color: 'white' }}>
                          {teachers[parseInt(selectedClassIndex, 10)]?.name}
                        </span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
                    {(selectedStudentId || selectedClassIndex !== '') && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setSelectedStudentId('');
                          setSelectedClassIndex('');
                          setStudentFilter('');
                        }}
                      >
                        Clear Selection
                      </button>
                    )}
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!selectedStudentId || selectedClassIndex === ''}
                      onClick={handleAddOutOfClassConstraint}
                    >
                      Add Constraint
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
