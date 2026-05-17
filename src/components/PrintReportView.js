/**
 * PrintReportView - Print-optimized class list report layout.
 *
 * Reads from existing contexts and renders one page per class.
 * Hidden on screen by CSS; shown only in @media print.
 */
function PrintReportView() {
  const { students, assignment, locked, keepApart, keepTogether, keepOutOfClass } =
    useStudentsExport();
  const { numericCriteria, flagCriteria } = useCriteriaExport();
  const { teachers } = useAppStateExport();

  const reportData = useMemo(
    () =>
      buildPrintReportData(
        students,
        assignment,
        locked,
        keepApart,
        keepTogether,
        keepOutOfClass,
        teachers,
        numericCriteria,
        flagCriteria
      ),
    [
      students,
      assignment,
      locked,
      keepApart,
      keepTogether,
      keepOutOfClass,
      teachers,
      numericCriteria,
      flagCriteria,
    ]
  );

  const { generatedAt, totalStudents, totalAssigned, numClasses, classPages, constraintSummary } =
    reportData;
  const hasConstraints =
    constraintSummary.keepTogether.length > 0 ||
    constraintSummary.keepApart.length > 0 ||
    constraintSummary.keepOutOfClass.length > 0;

  // Portal to <body> so #print-report is a sibling of #root, not a deep
  // descendant. The print CSS hides body's other children with display:none;
  // that idiom only works when the report is a top-level body child, and it
  // preserves normal block flow so page-break-after on each .print-page fires.
  return ReactDOM.createPortal(
    <div id="print-report" className="print-report">
      {/* Summary / cover page */}
      <div className="print-page print-summary-page">
        <h1>Class List Report</h1>
        <p className="print-summary-date">Generated: {generatedAt}</p>
        <div className="print-summary-stats">
          <div className="print-stat-badge">
            <strong>Total Students:</strong> {totalStudents}
          </div>
          <div className="print-stat-badge">
            <strong>Assigned:</strong> {totalAssigned}
          </div>
          <div className="print-stat-badge">
            <strong>Classes:</strong> {numClasses}
          </div>
        </div>

        <h3 className="print-section-heading">Class Overview</h3>
        <table className="print-student-table print-overview-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Students</th>
              <th>M</th>
              <th>F</th>
              {classPages[0]?.uCount !== undefined &&
                classPages.some(p => p.uCount > 0) && <th>U</th>}
              {numericCriteria.map(c => (
                <th key={c.key}>{c.label}</th>
              ))}
              {flagCriteria.map(c => (
                <th key={c.key}>{c.label}</th>
              ))}
              {flagCriteria.length > 0 && <th>Total Flags</th>}
            </tr>
          </thead>
          <tbody>
            {classPages.map(page => (
              <tr key={page.classIndex}>
                <td><strong>{page.teacherName}</strong></td>
                <td>{page.studentCount}</td>
                <td>{page.mCount}</td>
                <td>{page.fCount}</td>
                {classPages.some(p => p.uCount > 0) && <td>{page.uCount}</td>}
                {page.numericStats.map(s => (
                  <td key={s.key}>{s.avg}</td>
                ))}
                {page.flagStats.map(s => (
                  <td key={s.key}>{s.count}</td>
                ))}
                {flagCriteria.length > 0 && <td>{page.totalFlagsCount}</td>}
              </tr>
            ))}
          </tbody>
        </table>

        {hasConstraints && (
          <>
            <h3 className="print-section-heading">Constraints</h3>
            <div className="print-constraints">
              {constraintSummary.keepTogether.length > 0 && (
                <div className="print-constraint-group">
                  <h4>Keep Together</h4>
                  <ul>
                    {constraintSummary.keepTogether.map((group, i) => (
                      <li key={i}>{group.join(', ')}</li>
                    ))}
                  </ul>
                </div>
              )}
              {constraintSummary.keepApart.length > 0 && (
                <div className="print-constraint-group">
                  <h4>Keep Apart</h4>
                  <ul>
                    {constraintSummary.keepApart.map(([a, b], i) => (
                      <li key={i}>{a} ↔ {b}</li>
                    ))}
                  </ul>
                </div>
              )}
              {constraintSummary.keepOutOfClass.length > 0 && (
                <div className="print-constraint-group">
                  <h4>Keep Out of Class</h4>
                  <ul>
                    {constraintSummary.keepOutOfClass.map((c, i) => (
                      <li key={i}>
                        {c.name} — not in {c.teacherName}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* One page per class. We pick a density class based on student count
          and let CSS tighten font-size/padding so even large classes fit on
          a single printed page. */}
      {classPages.map(page => {
        const density =
          page.studentCount >= 26 ? 'print-page--ultra'
            : page.studentCount >= 19 ? 'print-page--dense'
            : '';
        return (
        <div className={`print-page ${density}`} key={page.classIndex}>
          <div className="print-page-header">
            <h2>{page.teacherName}</h2>
            <div className="print-page-meta">
              <span>
                Class {page.classIndex + 1} • {page.studentCount} students
              </span>
            </div>
          </div>

          <div className="print-page-stats">
            {page.numericStats.map(stat => (
              <div key={stat.key} className="print-stat-badge">
                {stat.label}: {stat.avg}
              </div>
            ))}
            {page.flagStats.map(stat => (
              <div
                key={stat.key}
                className="print-stat-badge"
                style={{ background: stat.colors.bg, color: stat.colors.fg }}
              >
                {stat.label}: {stat.count}
              </div>
            ))}
            {flagCriteria.length > 0 && (
              <div className="print-stat-badge">Total Flags: {page.totalFlagsCount}</div>
            )}
          </div>

          <table className="print-student-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Gender</th>
                {numericCriteria.map(c => (
                  <th key={c.key}>{c.label}</th>
                ))}
                {flagCriteria.map(c => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {page.studentRows.map(s => (
                <tr key={s.id}>
                  <td>{s.index}</td>
                  <td>{s.name}</td>
                  <td>
                    <span className={`badge badge-${s.gender || 'U'}`}>{s.gender || 'U'}</span>
                  </td>
                  {numericCriteria.map(c => (
                    <td key={c.key}>{s[c.key] ?? 0}</td>
                  ))}
                  {flagCriteria.map((c, idx) => (
                    <td key={c.key}>
                      {s[c.key] ? (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: generateColor(c.key, idx, 'light').dot,
                            display: 'inline-block',
                          }}
                          title={c.label}
                        />
                      ) : (
                        <span style={{ display: 'inline-block', width: 8, height: 8 }} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="print-page-footer">
            <span>
              <strong>{page.studentCount}</strong> students
            </span>
            <span>
              <strong>{page.mCount}</strong> Male
            </span>
            <span>
              <strong>{page.fCount}</strong> Female
            </span>
            {page.uCount > 0 && (
              <span>
                <strong>{page.uCount}</strong> Unspecified
              </span>
            )}
          </div>
        </div>
        );
      })}
    </div>,
    document.body
  );
}
