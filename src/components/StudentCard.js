function StudentCard({ student, locked, onToggleLock, onDragStart, dragging, flagCriteria, numericCriteria, keepApart = [], keepTogether = [], allStudents = [] }) {
  const activeFlags = flagCriteria.filter(c => student[c.key]);
  const [showDetail, setShowDetail] = useState(false);
  const didDrag = useRef(false);

  // Check if student has any constraints
  const hasKeepApart = keepApart.some(([id1, id2]) => id1 === student.id || id2 === student.id);
  const hasKeepTogether = keepTogether.some(group => group.includes(student.id));
  const hasConstraints = hasKeepApart || hasKeepTogether;

  // Get constraint details for this student
  const studentKeepApart = keepApart.filter(([id1, id2]) => id1 === student.id || id2 === student.id);
  const studentKeepTogether = keepTogether.filter(group => group.includes(student.id));

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
              title={hasKeepApart && hasKeepTogether
                ? 'Has keep-apart and keep-together constraints'
                : hasKeepApart
                  ? 'Has keep-apart constraint(s)'
                  : 'Has keep-together constraint(s)'}
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
          allStudents={allStudents}
        />
      )}
    </>
  );
}
