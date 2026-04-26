function StudentFormModal({ student, onSave, onClose, numericCriteria, flagCriteria }) {
  const initialForm = {
    name: '',
    gender: 'M',
    ...Object.fromEntries(numericCriteria.map(c => [c.key, ''])),
    ...Object.fromEntries(flagCriteria.map(c => [c.key, false])),
  };

  const [form, setForm] = useState(student ? { ...student } : { ...initialForm, id: uid() });

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function handleSave() {
    if (!form.name.trim()) return;

    const result = { ...form };
    numericCriteria.forEach(({ key }) => {
      result[key] = parseFloat(form[key]) || 0;
    });

    onSave(result);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{student ? 'Edit Student' : 'Add Student'}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-row cols2">
            <div className="form-group">
              <label className="form-label">Full Name (Last First — no commas)</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value.replace(/,/g, ''))} placeholder="Smith Emma" />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="U">Unspecified</option>
              </select>
            </div>
          </div>

          {numericCriteria.length > 0 && (
            <>
              <div className="divider" />
              <div className="panel-title" style={{ marginBottom: 8 }}>Numeric Scores</div>
              <div className="form-row" style={{ gridTemplateColumns: `repeat(${Math.min(numericCriteria.length, 3)}, 1fr)` }}>
                {numericCriteria.map(c => (
                  <div key={c.key} className="form-group">
                    <label className="form-label">{c.label}</label>
                    <input
                      className="form-input"
                      type="number"
                      value={form[c.key]}
                      onChange={e => set(c.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {flagCriteria.length > 0 && (
            <>
              <div className="divider" />
              <div className="panel-title" style={{ marginBottom: 8 }}>Flags</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                {flagCriteria.map(c => (
                  <label key={c.key} className="form-check">
                    <input type="checkbox" checked={!!form[c.key]} onChange={e => set(c.key, e.target.checked)} />
                    <span style={{ fontSize: 13 }}>{c.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!form.name.trim()}>
            {student ? 'Save Changes' : 'Add Student'}
          </button>
        </div>
      </div>
    </div>
  );
}
