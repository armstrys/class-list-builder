function ConstraintManager({
  students,
  keepApart,
  onAddKeepApart,
  onRemoveKeepApart,
  onClose,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [filter, setFilter] = useState('');

  const studentById = Object.fromEntries(students.map(s => [s.id, s]));

  // Filter students by name
  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(filter.toLowerCase())
  );

  // Get groups (connected components) from keepApart pairs
  function getGroups() {
    const groups = [];
    const visited = new Set();
    const adj = {};

    // Build adjacency list
    students.forEach(s => { adj[s.id] = []; });
    keepApart.forEach(([id1, id2]) => {
      if (adj[id1]) adj[id1].push(id2);
      if (adj[id2]) adj[id2].push(id1);
    });

    // Find connected components
    students.forEach(s => {
      if (visited.has(s.id)) return;
      const group = [];
      const stack = [s.id];
      while (stack.length > 0) {
        const id = stack.pop();
        if (visited.has(id)) continue;
        visited.add(id);
        group.push(id);
        adj[id].forEach(neighbor => {
          if (!visited.has(neighbor)) stack.push(neighbor);
        });
      }
      if (group.length > 1) groups.push(group);
    });

    return groups;
  }

  const groups = getGroups();

  function toggleSelection(id) {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id]; // Keep last selected, add new
      }
      return [...prev, id];
    });
  }

  function handleAddConstraint() {
    if (selectedIds.length === 2) {
      onAddKeepApart(selectedIds[0], selectedIds[1]);
      setSelectedIds([]);
    }
  }

  function handleRemoveFromGroup(id1, id2) {
    onRemoveKeepApart(id1, id2);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, width: '90%' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Student Constraints</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 20 }}>
          {/* Existing Constraints */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 500 }}>Keep Apart Groups</h4>
            {groups.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>
                No keep-apart constraints set yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groups.map((group, idx) => (
                  <div key={idx} className="constraint-group" style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--text3)', marginRight: 8 }}>
                        Group {idx + 1}:
                      </span>
                      {group.map((id, i) => (
                        <React.Fragment key={id}>
                          <span className="badge" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
                            {studentById[id]?.name || id}
                          </span>
                          {i < group.length - 1 && (
                            <span style={{ color: 'var(--text3)' }}>↔</span>
                          )}
                        </React.Fragment>
                      ))}
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ marginLeft: 'auto' }}
                        onClick={() => {
                          // Remove all pairs within this group
                          for (let i = 0; i < group.length; i++) {
                            for (let j = i + 1; j < group.length; j++) {
                              handleRemoveFromGroup(group[i], group[j]);
                            }
                          }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Constraint */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 500 }}>Add Keep-Apart Constraint</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text3)' }}>
              Select two students who should be placed in different classes.
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
                    <span className={`badge badge-${s.gender}`} style={{ marginLeft: 'auto' }}>
                      {s.gender}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13 }}>
                Selected: {selectedIds.length === 0 ? 'None' : selectedIds.map(id => studentById[id]?.name).join(' + ')}
              </span>
              <button
                className="btn btn-primary btn-sm"
                disabled={selectedIds.length !== 2}
                onClick={handleAddConstraint}
                style={{ marginLeft: 'auto' }}
              >
                Add Constraint
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
