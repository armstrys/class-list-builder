function SampleDataDialog({ defaultCount, onGenerate, onClose }) {
  const [count, setCount] = useState(String(defaultCount));

  function handleGenerate() {
    const n = parseInt(count);
    if (!n || n < 2) return;
    onGenerate(Math.min(10000, n));
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Generate Sample Data" size="sm" style={{ maxWidth: 340 }}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={!parseInt(count) || parseInt(count) < 2}>
            Generate
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group">
          <label className="form-label" htmlFor="sample-count">Number of students</label>
          <input
            id="sample-count"
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
    </Modal>
  );
}
