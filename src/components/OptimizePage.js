function OptimizePage({
  students,
  teachers,
  setTeachers,
  onBack,
  numericCriteria,
  flagCriteria,
}) {
  const [assignment, setAssignment] = useState({});
  const [locked, setLocked] = useState(new Set());
  const [draggingId, setDraggingId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [cost, setCost] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && fullscreen) setFullscreen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const numClasses = teachers.length;

  function runOptimize(lockedAssignments) {
    setOptimizing(true);
    setTimeout(() => {
      const lockedObj = {};
      lockedAssignments.forEach((classIdx, sid) => { lockedObj[sid] = classIdx; });
      const result = optimize(students, numClasses, lockedObj, numericCriteria, flagCriteria);
      setAssignment(result);
      setCost(computeCost(students, result, numClasses, numericCriteria, flagCriteria));
      setOptimizing(false);
    }, 30);
  }

  useEffect(() => { runOptimize(new Map()); }, []);

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
    setCost(computeCost(students, newAssignment, numClasses, numericCriteria, flagCriteria));
    setDraggingId(null);
  }

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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', borderRight: '1px solid var(--border)', paddingRight: 10, marginRight: 2 }}>
            {flagCriteria.map(c => (
              <span key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: 'var(--text3)' }} title={c.label}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: generateColor(c.key).dot, flexShrink: 0 }} />
                {c.short}
              </span>
            ))}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => triggerDownload(exportClassListsToCSV(students, assignment, teachers, numericCriteria, flagCriteria), 'class-lists.csv', 'text/csv')}
            title="Download class lists as CSV"
          >⬇ Export Lists</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setFullscreen(true)} title="Fullscreen class lists">⛶ Fullscreen</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowHelp(true)}>? How it works</button>
        </div>
      </div>}

      <div className="classes-area" style={{ flex: 1 }}>
        {classesByIdx.map((classStudents, i) => (
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
          />
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
    </div>
  );
}
