// Convert the first worksheet of an xlsx/xls ArrayBuffer to CSV text using
// ExcelJS (bundled). ExcelJS exposes itself as the global `ExcelJS`.
//
// For merged cells, only the master cell's value is emitted; slaves emit
// empty so the CSV stays aligned to the underlying grid. This matches
// SheetJS's sheet_to_csv behavior and prevents a merged title row from
// becoming N identical header columns.
function _formatCellValue(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if ('text' in v) return String(v.text);
    if ('result' in v) return String(v.result);
    if ('richText' in v) return v.richText.map((rt) => rt.text).join('');
    if ('hyperlink' in v) return String(v.text || v.hyperlink);
    return String(v);
  }
  return String(v);
}

async function xlsxBufferToCsv(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return '';

  const lines = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells = [];
    let maxCol = 0;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (colNumber > maxCol) maxCol = colNumber;
      // Only emit the master cell's value for merged ranges; slaves are blank.
      if (cell.isMerged && cell.master && cell.master !== cell) {
        cells[colNumber - 1] = '';
      } else {
        cells[colNumber - 1] = _formatCellValue(cell.value);
      }
    });
    for (let i = 0; i < maxCol; i++) {
      if (cells[i] === undefined) cells[i] = '';
    }
    lines.push(cells.map(escapeCSVValue).join(','));
  });
  return lines.join('\n');
}

function ImportModal({ onImport, onClose, numericCriteria, flagCriteria, students, onClearAll }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const fileInputRef = useRef(null);

  const csvTemplate = 'id,' + generateCSVHeaders(numericCriteria, flagCriteria).join(',') + '\n' +
    'stu001,Emma Smith,F,' + numericCriteria.map(() => '75').join(',') + ',' + flagCriteria.map(() => '0').join(',') + '\n' +
    'stu002,Liam Johnson,M,' + numericCriteria.map(() => '82').join(',') + ',' + flagCriteria.map(() => '1').join(',');

  function processFile(file) {
    if (!file) return;
    
    setIsLoading(true);
    setError('');
    setFileName(file.name);
    
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        let csvText = '';

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          csvText = await xlsxBufferToCsv(e.target.result);
        } else {
          csvText = e.target.result;
        }

        setText(csvText);
        generatePreview(csvText);
      } catch (err) {
        setError('Could not read file. Please check the format and try again.');
        setPreview(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    reader.onerror = () => {
      setError('Error reading file.');
      setIsLoading(false);
    };
    
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  }

  function generatePreview(csvText) {
    const allLines = csvText.trim().split('\n').filter(line => line.trim());
    const dataLines = allLines.slice(1); // Exclude header
    const previewLines = allLines.slice(0, 4); // Header + first 3 rows for display
    
    setTotalRows(dataLines.length);
    
    if (previewLines.length < 2) {
      setPreview(null);
      return;
    }
    
    // Parse header
    const headers = previewLines[0].split(',').map(h => h.trim());
    const rows = previewLines.slice(1).map(line => line.split(','));
    
    setPreview({ headers, rows, totalDataRows: dataLines.length });
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        processFile(file);
      } else {
        setError('Please drop a CSV or Excel file (.csv, .xlsx, .xls)');
      }
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = ''; // Reset input
  }

  function handleImport() {
    if (!text.trim()) {
      setError('No data to import. Please upload a file or paste CSV data.');
      return;
    }
    
    const { students: importedStudents, errors } = parseCSV(text, numericCriteria, flagCriteria);
    if (!importedStudents.length) {
      setError(errors.length ? errors.join('; ') : 'No valid students found. Check your CSV format.');
      return;
    }
    onImport(importedStudents);
    if (errors.length) {
      window.alert(`⚠️ Imported ${importedStudents.length} students with warnings:\n\n${errors.join('\n')}`);
    }
    onClose();
  }

  function handleTextPaste(e) {
    const newText = e.target.value;
    setText(newText);
    setError('');
    if (newText.trim()) {
      generatePreview(newText);
      setFileName('Pasted data');
    } else {
      setPreview(null);
      setFileName('');
    }
  }

  const footer = (
    <>
      <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button 
        className="btn btn-primary" 
        onClick={handleImport} 
        disabled={!text.trim() || isLoading}
      >
        Import {totalRows > 0 ? `${totalRows} student${totalRows !== 1 ? 's' : ''}` : ''}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Import Students"
      size="lg"
      footer={footer}
    >
          {/* Append warning banner */}
          <div className="import-warning-banner">
            <div className="import-warning-icon">ℹ️</div>
            <div className="import-warning-text">
              <strong>Importing appends to existing students.</strong>
              {students.length > 0 && (
                <span> You currently have {students.length} student{students.length !== 1 ? 's' : ''}.</span>
              )}
            </div>
          </div>
          
          {/* Clear All button - more prominent placement */}
          {onClearAll && students.length > 0 && (
            <div className="import-clear-section">
              <button className="btn btn-danger btn-sm" onClick={onClearAll}>
                Clear all {students.length} existing students first
              </button>
              <span className="import-clear-hint">Use this if you want to replace your current list instead of adding to it.</span>
            </div>
          )}

          {/* File upload area */}
          {!showPaste && (
            <div
              className={`drop-zone ${dragOver ? 'drag-over' : ''} ${isLoading ? 'loading' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isLoading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              
              {isLoading ? (
                <div className="drop-zone-content">
                  <div className="drop-zone-icon">⏳</div>
                  <div>Reading file...</div>
                </div>
              ) : fileName ? (
                <div className="drop-zone-content">
                  <div className="drop-zone-icon">📄</div>
                  <div className="drop-zone-filename">{fileName}</div>
                  <div className="drop-zone-hint">Click or drop to replace</div>
                </div>
              ) : (
                <div className="drop-zone-content">
                  <div className="drop-zone-icon">📁</div>
                  <div className="drop-zone-title">Drop a file or click to browse</div>
                  <div className="drop-zone-hint">Supports CSV and Excel (.xlsx, .xls)</div>
                </div>
              )}
            </div>
          )}

          {/* Toggle paste mode */}
          <div className="import-toggle">
            <button className="btn btn-text btn-sm" onClick={() => setShowPaste(!showPaste)}>
              {showPaste ? '← Back to file upload' : 'Or paste CSV text →'}
            </button>
          </div>

          {/* Paste textarea */}
          {showPaste && (
            <div className="paste-section">
              <textarea 
                className="csv-area" 
                value={text} 
                onChange={handleTextPaste}
                placeholder={csvTemplate}
                rows={8}
              />
              <p className="csv-hint">
                <strong>Required:</strong> name, gender | 
                <strong> Optional:</strong> id, {generateCSVHeaders(numericCriteria, flagCriteria).slice(2).join(', ')}
              </p>
              <p className="csv-hint" style={{ marginTop: 6, fontSize: 11 }}>
                <strong>Tip:</strong> Include an <code>id</code> column to use your own student IDs. Otherwise, IDs are auto-generated.
              </p>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="import-preview">
              <div className="import-preview-header">
                <strong>Preview</strong>
                <span className="import-preview-count">
                  Showing {preview.rows.length} of {preview.totalDataRows} student{preview.totalDataRows !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="import-preview-table-wrap">
                <table className="import-preview-table">
                  <thead>
                    <tr>
                      {preview.headers.map((h, i) => (
                        <th key={i} className={i < 2 ? 'col-required' : ''}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className={j < 2 ? 'col-required' : ''}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && <p className="import-error">{error}</p>}
    </Modal>
  );
}
