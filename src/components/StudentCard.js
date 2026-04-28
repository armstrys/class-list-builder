function StudentCard({ student, locked, onToggleLock, onDragStart, dragging, flagCriteria, numericCriteria, keepApart = [], keepTogether = [], keepOutOfClass = [], allStudents = [] }) {
  const activeFlags = useMemo(() => 
    flagCriteria.filter(c => student[c.key]),
    [flagCriteria, student]
  );
  const [showDetail, setShowDetail] = useState(false);
  const didDrag = useRef(false);

  // Memoize constraint calculations to prevent re-computation on every render
  const constraints = useMemo(() => {
    const hasKeepApart = keepApart.some(([id1, id2]) => id1 === student.id || id2 === student.id);
    const hasKeepTogether = keepTogether.some(group => group.includes(student.id));
    const hasKeepOutOfClass = keepOutOfClass.some(c => c.studentId === student.id);
    
    return {
      hasKeepApart,
      hasKeepTogether,
      hasKeepOutOfClass,
      hasConstraints: hasKeepApart || hasKeepTogether || hasKeepOutOfClass,
      studentKeepApart: keepApart.filter(([id1, id2]) => id1 === student.id || id2 === student.id),
      studentKeepTogether: keepTogether.filter(group => group.includes(student.id)),
      studentKeepOutOfClass: keepOutOfClass.filter(c => c.studentId === student.id)
    };
  }, [keepApart, keepTogether, keepOutOfClass, student.id]);

  const {
    hasKeepApart,
    hasKeepTogether,
    hasKeepOutOfClass,
    hasConstraints,
    studentKeepApart,
    studentKeepTogether,
    studentKeepOutOfClass
  } = constraints;

  return (
    <>
      <div
        className={`student-card${locked ? ' locked' : ''}${dragging ? ' dragging' : ''}`}
        draggable
        onDragStart={e => { didDrag.current = true; onDragStart(e, student.id); }}
        onDragEnd={() => { setTimeout(() => { didDrag.current = false; }, 100); }}
        onClick={() => { if (!didDrag.current) setShowDetail(true); }}
        style={{ cursor: 'grab' }}
      >
        <div className="student-card-top">
          <span className={`badge badge-${student.gender}`}>{student.gender}</span>
          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>{student.id}</span>
          <span className="student-name">{student.name}</span>
          {activeFlags.length > 0 && (
            <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              {activeFlags.map(c => (
                <span key={c.key} style={{ width: 6, height: 6, borderRadius: '50%', background: generateColor(c.key).dot, flexShrink: 0 }} title={c.label} />
              ))}
            </span>
          )}
          {hasConstraints && (
            <span
              style={{ fontSize: 14, cursor: 'help' }}
              title={[
                hasKeepApart && 'Has keep-apart constraint(s)',
                hasKeepTogether && 'Has keep-together constraint(s)',
                hasKeepOutOfClass && 'Has keep-out-of-class constraint(s)'
              ].filter(Boolean).join(' + ')}
            >
              🔗
            </span>
          )}
          <button
            className={`lock-btn${locked ? ' locked' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleLock(student.id); }}
            title={locked ? 'Unlock student' : 'Lock to this class'}
          >
            {locked ? '🔒' : '🔓'}
          </button>
        </div>
      </div>
      {showDetail && (
        <StudentDetailModal
          student={student}
          locked={locked}
          onToggleLock={onToggleLock}
          onClose={() => setShowDetail(false)}
          numericCriteria={numericCriteria}
          flagCriteria={flagCriteria}
          keepApart={studentKeepApart}
          keepTogether={studentKeepTogether}
          keepOutOfClass={studentKeepOutOfClass}
          allStudents={allStudents}
        />
      )}
    </>
  );
}
