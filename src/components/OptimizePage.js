function OptimizePage({
  students,
  teachers,
  setTeachers,
  onBack,
  numericCriteria,
  flagCriteria,
  keepApart = [],
  onAddKeepApart,
  onRemoveKeepApart,
  keepTogether = [],
  onAddKeepTogether,
  onRemoveKeepTogether,
  keepOutOfClass = [],
  onAddKeepOutOfClass,
  onRemoveKeepOutOfClass,
  assignment,
  setAssignment,
  locked,
  setLocked,
}) {
  const [draggingId, setDraggingId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showConstraints, setShowConstraints] = useState(false);
  const [showViolations, setShowViolations] = useState(false);
  const [cost, setCost] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showClassFilter, setShowClassFilter] = useState(false);
  const [visibleClasses, setVisibleClasses] = useState(new Set());

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && fullscreen) setFullscreen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  // Initialize visible classes when teachers change
  useEffect(() => {
    setVisibleClasses(new Set(teachers.map((_, i) => i)));
  }, [teachers.length]);

  const numClasses = teachers.length;

  function runOptimize(lockedAssignments) {
    setOptimizing(true);
    setTimeout(() => {
      const lockedObj = {};
      lockedAssignments.forEach((classIdx, sid) => { lockedObj[sid] = classIdx; });
      const result = optimize(students, numClasses, lockedObj, numericCriteria, flagCriteria, keepApart, keepTogether, keepOutOfClass);
      setAssignment(result);
      setCost(computeCost(students, result, numClasses, numericCriteria, flagCriteria, keepApart, keepTogether, keepOutOfClass));
      setOptimizing(false);
    }, 30);
  }

  useEffect(() => { 
    // Only run initial optimization if we don't have an assignment yet
    if (!assignment || Object.keys(assignment).length === 0) {
      runOptimize(new Map()); 
    }
  }, []);

  function handleReoptimize() {
    const lockedObj = new Map();
    locked.forEach(sid => {
      if (assignment[sid] !== undefined) lockedObj.set(sid, assignment[sid]);
    });
    runOptimize(lockedObj);
  }

  function handleToggleLock(sid) {
    setLocked(prev => {
      const next = new Set(prev);
      next.has(sid) ? next.delete(sid) : next.add(sid);
      return next;
    });
  }

  function handleLockAll() {
    setLocked(new Set(students.map(s => s.id)));
  }
  function handleUnlockAll() {
    setLocked(new Set());
  }

  function handleDragStart(e, sid) {
    setDraggingId(sid);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sid);
  }

  function handleDrop(e, classIdx) {
    const sid = e.dataTransfer.getData('text/plain') || draggingId;
    if (!sid) return;
    const newAssignment = { ...assignment, [sid]: classIdx };
    setAssignment(newAssignment);
    setCost(computeCost(students, newAssignment, numClasses, numericCriteria, flagCriteria, keepApart, keepTogether, keepOutOfClass));
    setDraggingId(null);
  }

  // Calculate keep-apart violations for display
  const apartViolations = keepApart.filter(([id1, id2]) => {
    const c1 = assignment[id1];
    const c2 = assignment[id2];
    return c1 !== undefined && c2 !== undefined && c1 === c2;
  });

  // Calculate keep-together violations for display
  const togetherViolations = keepTogether.filter(group => {
    if (group.length < 2) return false;
    const classes = new Set();
    for (const id of group) {
      const c = assignment[id];
      if (c !== undefined) classes.add(c);
    }
    return classes.size > 1;
  });

  // Calculate keep-out-of-class violations for display
  const outOfClassViolations = keepOutOfClass.filter(({ studentId, classIndex }) => {
    const assignedClass = assignment[studentId];
    return assignedClass !== undefined && assignedClass === classIndex;
  });

  // Total violations
  const totalViolations = apartViolations.length + togetherViolations.length + outOfClassViolations.length;

  const classesByIdx = Array.from({ length: numClasses }, (_, i) =>
    students.filter(s => assignment[s.id] === i)
      .sort((a, b) => {
        const aLocked = locked.has(a.id) ? 1 : 0;
        const bLocked = locked.has(b.id) ? 1 : 0;
        if (aLocked !== bLocked) return aLocked - bLocked;
        return a.name.localeCompare(b.name);
      })
  );

  const costColor = cost !== null
    ? (cost < 0.05 ? 'var(--accent)' : cost < 0.15 ? 'var(--amber)' : 'var(--danger)')
    : 'var(--text3)';

  return (
    <div className="optimize-layout" style={fullscreen ? { position: 'fixed', inset: 0, zIndex: 500, background: 'var(--bg)' } : {}}>
      {!fullscreen && <div className="optimize-toolbar">
        <button className="btn btn-secondary btn-sm" onClick={onBack}>← Setup</button>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleReoptimize}
          disabled={optimizing}
        >
          {optimizing ? '⟳ Optimizing…' : '⟳ Re-Optimize'}
        </button>
        <div className="lock-legend">
          <span className="locked-count">{locked.size}</span>
          <span>locked</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLockAll}>Lock All</button>
          <button className="btn btn-ghost btn-sm" onClick={handleUnlockAll}>Unlock All</button>
        </div>
        {cost !== null && (
          <div className="score-badge">
            <span className="label">Balance score</span>
            <span className="value" style={{ color: costColor }}>{cost.toFixed(4)}</span>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>(lower is better)</span>
          </div>
        )}
        {totalViolations > 0 && (
          <button
            className="violations-badge"
            onClick={() => setShowViolations(true)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Click to see violated constraints"
          >
            <span style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 500 }}>
              ⚠️ {totalViolations} violation{totalViolations === 1 ? '' : 's'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>ℹ️</span>
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', borderRight: '1px solid var(--border)', paddingRight: 10, marginRight: 2 }}>
            {flagCriteria.map(c => (
              <span key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: 'var(--text3)' }} title={c.label}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: generateColor(c.key).dot, flexShrink: 0 }} />
                {c.short}
              </span>
            ))}
          </div>
          <ClassFilterDropdown
            teachers={teachers}
            visibleClasses={visibleClasses}
            setVisibleClasses={setVisibleClasses}
            showClassFilter={showClassFilter}
            setShowClassFilter={setShowClassFilter}
            students={students}
            assignment={assignment}
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowConstraints(true)}
            title="View and edit constraints"
          >
            🔗 Constraints {(keepApart.length + keepTogether.length + keepOutOfClass.length) > 0 && `(${keepApart.length + keepTogether.length + keepOutOfClass.length})`}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => triggerDownload(exportClassListsToCSV(students, assignment, teachers, numericCriteria, flagCriteria), 'class-lists.csv', 'text/csv')}
            title="Save class lists as CSV"
          >⬇ Save Lists</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setFullscreen(true)} title="Fullscreen class lists">⛶ Fullscreen</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowHelp(true)}>? How it works</button>
        </div>
      </div>}

      <div className="classes-area" style={{ flex: 1 }}>
        {classesByIdx.map((classStudents, i) => (
          visibleClasses.has(i) && (
          <ClassColumn
            key={i}
            classIdx={i}
            name={teachers[i]?.name || `Class ${i + 1}`}
            onNameChange={(idx, val) => setTeachers(prev => prev.map((t, j) => j === idx ? { ...t, name: val } : t))}
            students={classStudents}
            locked={locked}
            onToggleLock={handleToggleLock}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            draggingId={draggingId}
            allStudents={students}
            fullscreen={fullscreen}
            numericCriteria={numericCriteria}
            flagCriteria={flagCriteria}
            keepApart={keepApart}
            keepTogether={keepTogether}
          />
          )
        ))}
      </div>

      {fullscreen && (
        <button
          onClick={() => setFullscreen(false)}
          style={{
            position: 'fixed', top: 12, right: 16, zIndex: 200,
            background: 'var(--surface)', border: '1.5px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '6px 12px',
            cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
            fontWeight: 500, color: 'var(--text2)',
            boxShadow: 'var(--shadow)',
          }}
        >
          ✕ Exit Fullscreen (Esc)
        </button>
      )}

      {!fullscreen && <StatsStrip
        students={students}
        assignment={assignment}
        numClasses={numClasses}
        numericCriteria={numericCriteria}
        flagCriteria={flagCriteria}
      />}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} numericCriteria={numericCriteria} flagCriteria={flagCriteria} />}

      {showConstraints && (
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
          onClose={() => setShowConstraints(false)}
        />
      )}

      {showViolations && (
        <ViolationsModal
          apartViolations={apartViolations}
          togetherViolations={togetherViolations}
          outOfClassViolations={outOfClassViolations}
          students={students}
          assignment={assignment}
          teachers={teachers}
          onClose={() => setShowViolations(false)}
          onOpenConstraints={() => {
            setShowViolations(false);
            setShowConstraints(true);
          }}
        />
      )}
    </div>
  );
}

// Modal to display constraint violations in detail
function ViolationsModal({ apartViolations, togetherViolations, outOfClassViolations, students, assignment, teachers, onClose, onOpenConstraints }) {
  const studentById = Object.fromEntries(students.map(s => [s.id, s]));

  // Get class name for a student
  function getClassName(studentId) {
    const classIdx = assignment[studentId];
    if (classIdx === undefined) return 'Unassigned';
    return teachers[classIdx]?.name || `Class ${classIdx + 1}`;
  }

  const hasApart = apartViolations.length > 0;
  const hasTogether = togetherViolations.length > 0;
  const hasOutOfClass = outOfClassViolations.length > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, width: '90%' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Constraint Violations</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 20 }}>
          {/* Explanation */}
          <div style={{
            padding: 12,
            background: 'var(--surface)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 20,
            fontSize: 13,
            color: 'var(--text2)',
            border: '1px solid var(--border)',
          }}>
            <strong>Why are constraints violated?</strong>
            <p style={{ margin: '8px 0 0 0' }}>
              The optimizer tries to balance all criteria while respecting your constraints. 
              Sometimes constraints conflict with each other or make class balance impossible. 
              Consider removing some constraints or manually adjusting the results.
            </p>
          </div>

          {/* Keep Apart Violations */}
          {hasApart && (
            <div style={{ marginBottom: 24 }}>
              <h4 style={{
                margin: '0 0 12px 0',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span>🚫</span>
                Keep-Apart Violations ({apartViolations.length})
              </h4>
              <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text3)' }}>
                These students should be in different classes but ended up together:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {apartViolations.map(([id1, id2], idx) => (
                  <div key={idx} style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge" style={{ background: 'var(--surface)', color: 'var(--text)' }}>
                        {studentById[id1]?.name || id1}
                      </span>
                      <span style={{ color: 'var(--text3)' }}>↔</span>
                      <span className="badge" style={{ background: 'var(--surface)', color: 'var(--text)' }}>
                        {studentById[id2]?.name || id2}
                      </span>
                    </div>
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: 11,
                      color: 'var(--danger)',
                      fontWeight: 500,
                    }}>
                      Both in: {getClassName(id1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keep Together Violations */}
          {hasTogether && (
            <div style={{ marginBottom: 24 }}>
              <h4 style={{
                margin: '0 0 12px 0',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span>🔗</span>
                Keep-Together Violations ({togetherViolations.length})
              </h4>
              <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text3)' }}>
                These students should be in the same class but were split up:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {togetherViolations.map((group, idx) => {
                  const classDistribution = {};
                  group.forEach(id => {
                    const className = getClassName(id);
                    if (!classDistribution[className]) classDistribution[className] = [];
                    classDistribution[className].push(studentById[id]?.name || id);
                  });

                  return (
                    <div key={idx} style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                    }}>
                      <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text3)' }}>
                        Group {idx + 1}:
                      </div>
                      {Object.entries(classDistribution).map(([className, names]) => (
                        <div key={className} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 4,
                          flexWrap: 'wrap',
                        }}>
                          <span style={{
                            fontSize: 11,
                            color: 'var(--danger)',
                            fontWeight: 500,
                            minWidth: 80,
                          }}>
                            {className}:
                          </span>
                          <span style={{ fontSize: 13 }}>
                            {names.join(', ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Keep Out of Class Violations */}
          {hasOutOfClass && (
            <div style={{ marginBottom: 24 }}>
              <h4 style={{
                margin: '0 0 12px 0',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span>🚫</span>
                Keep-Out-of-Class Violations ({outOfClassViolations.length})
              </h4>
              <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text3)' }}>
                These students should not be in their assigned class:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {outOfClassViolations.map(({ studentId, classIndex }, idx) => (
                  <div key={idx} style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge" style={{ background: 'var(--surface)', color: 'var(--text)' }}>
                        {studentById[studentId]?.name || studentId}
                      </span>
                      <span style={{ color: 'var(--text3)' }}>→</span>
                      <span className="badge" style={{ background: 'var(--warning)', color: 'white' }}>
                        {teachers[classIndex]?.name || `Class ${classIndex + 1}`}
                      </span>
                    </div>
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: 11,
                      color: 'var(--danger)',
                      fontWeight: 500,
                    }}>
                      Should be excluded
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          <div style={{
            padding: 12,
            background: 'var(--surface)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
          }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 500 }}>
              What can you do?
            </h5>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text2)' }}>
              <li>Click "Edit Constraints" below to remove conflicting constraints</li>
              <li>Try re-optimizing with fewer constraints</li>
              <li>Manually drag students to fix violations (locked students stay in place)</li>
              <li>Consider if some constraints are truly necessary</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={onOpenConstraints}>
            Edit Constraints
          </button>
        </div>
      </div>
    </div>
  );
}

// Class filter dropdown component
function ClassFilterDropdown({ teachers, visibleClasses, setVisibleClasses, showClassFilter, setShowClassFilter, students, assignment }) {
  const dropdownRef = useRef(null);
  const selectedCount = visibleClasses.size;
  const totalCount = teachers.length;
  const [studentFilter, setStudentFilter] = useState('');

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowClassFilter(false);
      }
    }
    if (showClassFilter) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showClassFilter, setShowClassFilter]);

  function toggleClass(classIdx) {
    setVisibleClasses(prev => {
      const next = new Set(prev);
      if (next.has(classIdx)) {
        next.delete(classIdx);
      } else {
        next.add(classIdx);
      }
      return next;
    });
  }

  function selectAll() {
    setVisibleClasses(new Set(teachers.map((_, i) => i)));
  }

  function clearAll() {
    setVisibleClasses(new Set());
  }

  // Find which class a student is in
  function getStudentClass(student) {
    const classIdx = assignment[student.id];
    if (classIdx === undefined) return null;
    return { index: classIdx, name: teachers[classIdx]?.name || `Class ${classIdx + 1}` };
  }

  // Filter students by name or ID
  const filteredStudents = studentFilter.trim() 
    ? students.filter(s => 
        s.name.toLowerCase().includes(studentFilter.toLowerCase()) ||
        s.id.toLowerCase().includes(studentFilter.toLowerCase())
      )
    : [];

  // Show class for a found student
  function showStudentClass(student) {
    const classInfo = getStudentClass(student);
    if (classInfo) {
      setVisibleClasses(new Set([classInfo.index]));
      setStudentFilter('');
      setShowClassFilter(false);
    }
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => setShowClassFilter(!showClassFilter)}
        title="Filter which classes to show"
      >
        👁️ Show Classes ({selectedCount}/{totalCount})
      </button>
      
      {showClassFilter && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow)',
            zIndex: 1000,
            minWidth: 220,
            maxWidth: 300,
            maxHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <button
              className="btn btn-ghost btn-sm"
              onClick={selectAll}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              Select All
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={clearAll}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              Clear All
            </button>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                color: 'var(--text3)',
              }}
            >
              {selectedCount} selected
            </span>
          </div>
          
          {/* Student search section */}
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface2)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 500 }}>
              Find Student
            </div>
            <input
              type="text"
              placeholder="Name or ID..."
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontFamily: 'inherit',
                background: 'var(--surface)',
                color: 'var(--text)',
                outline: 'none',
              }}
            />
            {filteredStudents.length > 0 && (
              <div style={{ marginTop: 8, maxHeight: 120, overflowY: 'auto' }}>
                {filteredStudents.slice(0, 5).map(student => {
                  const classInfo = getStudentClass(student);
                  return (
                    <div
                      key={student.id}
                      onClick={() => showStudentClass(student)}
                      style={{
                        padding: '6px 8px',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--surface)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {student.name}
                      </span>
                      {classInfo && (
                        <span style={{ fontSize: 10, color: 'var(--accent)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                          {classInfo.name}
                        </span>
                      )}
                    </div>
                  );
                })}
                {filteredStudents.length > 5 && (
                  <div style={{ fontSize: 10, color: 'var(--text3)', padding: '4px 8px', fontStyle: 'italic' }}>
                    ...and {filteredStudents.length - 5} more
                  </div>
                )}
              </div>
            )}
            {studentFilter.trim() && filteredStudents.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, fontStyle: 'italic' }}>
                No students found
              </div>
            )}
          </div>
          
          <div
            style={{
              overflowY: 'auto',
              padding: '6px 0',
              maxHeight: '40vh',
            }}
          >
            {teachers.map((teacher, i) => (
              <label
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                  fontSize: 13,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <input
                  type="checkbox"
                  checked={visibleClasses.has(i)}
                  onChange={() => toggleClass(i)}
                  style={{ cursor: 'pointer' }}
                />
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={teacher?.name || `Class ${i + 1}`}
                >
                  {teacher?.name || `Class ${i + 1}`}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text3)',
                    background: 'var(--surface2)',
                    padding: '1px 5px',
                    borderRadius: 4,
                  }}
                >
                  #{i + 1}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
