function ImportModal({ onImport, onClose, numericCriteria, flagCriteria, onImportConstraints }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const csvTemplate = generateCSVHeaders(numericCriteria, flagCriteria).join(',') + ',keep_apart_group,keep_together_group\n' +
    'Smith Emma,F,' + numericCriteria.map(() => '75').join(',') + ',' + flagCriteria.map(() => '0').join(',') + ',,\n' +
    'Johnson Liam,M,' + numericCriteria.map(() => '82').join(',') + ',' + flagCriteria.map(() => '1').join(',') + ',,';

  function handleImport() {
    const { students, errors, keepApart, keepTogether } = parseCSV(text, numericCriteria, flagCriteria);
    if (!students.length) {
      setError(errors.length ? errors.join('; ') : 'No valid students found. Check your CSV format.');
      return;
    }
    if (errors.length) setError(`Imported ${students.length} students with warnings: ${errors.join('; ')}`);
    onImport(students, keepApart, keepTogether);
    if (!errors.length) onClose();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Import Students from CSV</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
            Paste CSV data below. First row must be headers. Boolean fields: 1/yes/true = checked.
          </p>
          <textarea className="csv-area" value={text} onChange={e => { setText(e.target.value); setError(''); }}
            placeholder={csvTemplate} />
          <p className="csv-hint">
            <strong>Required headers:</strong> name, gender<br />
            <strong>Current criteria headers:</strong> {generateCSVHeaders(numericCriteria, flagCriteria).slice(2).join(', ')}
          </p>
          {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 8 }}>{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleImport} disabled={!text.trim()}>Import</button>
        </div>
      </div>
    </div>
  );
}
