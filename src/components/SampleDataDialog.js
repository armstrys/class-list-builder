function SampleDataDialog({ defaultCount, onGenerate, onClose }) {
  const [count, setCount] = useState(String(defaultCount));

  function handleGenerate() {
    const n = parseInt(count);
    if (!n || n < 2) return;
    onGenerate(Math.min(10000, n));
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 340 }}>
        <div className="modal-header">
          <div className="modal-title">Generate Sample Data</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Number of students</label>
            <input
              className="form-input"
              type="number"
              min="2"
              max="10000"
              value={count}
              onChange={e => setCount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              autoFocus
            />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>
            Randomly generates students with realistic score distributions.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={!parseInt(count) || parseInt(count) < 2}>
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
