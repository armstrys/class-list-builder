function StudentDetailModal({ student, locked, onToggleLock, onClose, numericCriteria, flagCriteria }) {
  const activeFlags = flagCriteria.filter(c => student[c.key]);
  const inactiveFlags = flagCriteria.filter(c => !student[c.key]);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <span className={`badge badge-${student.gender}`}>{student.gender}</span>
            <div className="modal-title">{student.name}</div>
          </div>
          <button
            className={`lock-btn${locked ? ' locked' : ''}`}
            style={{ fontSize: 18, marginRight: 8 }}
            onClick={() => onToggleLock(student.id)}
            title={locked ? 'Unlock student' : 'Lock to this class'}
          >{locked ? '🔒' : '🔓'}</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {numericCriteria.length > 0 && (
            <div>
              <div className="panel-title">Scores</div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(numericCriteria.length, 3)}, 1fr)`, gap: 10 }}>
                {numericCriteria.map(c => (
                  <div key={c.key} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 20, fontFamily: 'DM Mono, monospace', fontWeight: 500 }}>{student[c.key] || 0}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeFlags.length > 0 && (
            <div>
              <div className="panel-title">Active Flags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {activeFlags.map(c => {
                  const colors = generateColor(c.key);
                  return (
                    <span key={c.key} className="badge" style={{ fontSize: 12, padding: '3px 8px', background: colors.bg, color: colors.fg }}>{c.label}</span>
                  );
                })}
              </div>
            </div>
          )}
          {inactiveFlags.length > 0 && (
            <div>
              <div className="panel-title">No Flags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {inactiveFlags.map(c => (
                  <span key={c.key} style={{ fontSize: 12, color: 'var(--text3)' }}>{c.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
