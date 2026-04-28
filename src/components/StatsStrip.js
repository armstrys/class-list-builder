/**
 * StatsStrip - Display optimization statistics
 * 
 * Uses contexts:
 * - useStudents: Student data and assignment
 * - useCriteria: Criteria configuration
 * 
 * @param {Object} props
 * @param {number} props.numClasses - Number of classes
 */
function StatsStrip({ numClasses }) {
  const { students, assignment } = useStudentsExport();
  const { numericCriteria, flagCriteria } = useCriteriaExport();
  
  if (!students?.length) return null;
  if (!students.length) return null;

  const classes = Array.from({ length: numClasses }, (_, i) =>
    students.filter(s => assignment[s.id] === i)
  );

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  function barGroup(vals, maxVal) {
    return (
      <div className="stat-mini-bars">
        {vals.map((v, i) => (
          <div key={i} className="mini-bar" style={{
            height: maxVal > 0 ? Math.max(4, (v / maxVal) * 24) + 'px' : '4px',
            background: colors[i % colors.length],
            opacity: .8,
          }} />
        ))}
      </div>
    );
  }

  function varianceClass(cv) {
    if (cv < 0.10) return 'good';
    if (cv < 0.25) return 'warn';
    return 'bad';
  }

  const numItems = numericCriteria.map(m => {
    const allVals = students.map(s => s[m.key] || 0);
    const popMin = Math.min(...allVals);
    const popMax = Math.max(...allVals);
    const range = popMax - popMin || 1;
    const vals = classes.map(cls =>
      cls.length ? cls.reduce((s, st) => s + (st[m.key] || 0), 0) / cls.length : popMin
    );
    const mean = vals.reduce((a, b) => a + b, 0) / numClasses || 1;
    const popMean = allVals.reduce((a, b) => a + b, 0) / allVals.length;
    const popVar = allVals.reduce((s, v) => s + (v - popMean) ** 2, 0) / allVals.length;
    const varOfMeans = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / numClasses;
    const cv = popVar > 0 ? Math.sqrt(varOfMeans / popVar) : 0;
    const normVals = vals.map(v => Math.max(0, (v - popMin) / range));
    return { label: m.label, vals: normVals, maxVal: 1, cv };
  });

  const boolItems = flagCriteria.map(m => {
    const vals = classes.map(cls => cls.filter(s => s[m.key]).length);
    const mean = vals.reduce((a, b) => a + b, 0) / numClasses;
    const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / numClasses);
    return { label: m.label, vals, maxVal: Math.max(...vals, 1), cv: mean > 0 ? sd / mean : 0 };
  }).filter(b => b.vals.some(v => v > 0));

  const zParamsStrip = numericCriteria.map(({ key }) => {
    const vals = students.map(s => s[key] || 0);
    const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length || 1);
    return { key, mean, stdDev: Math.sqrt(variance) };
  });
  const studentScoreStrip = s => zParamsStrip.reduce((zs, { key, mean, stdDev }) =>
    stdDev > 0 ? zs + ((s[key] || 0) - mean) / stdDev : zs, 0);

  const compositeItems = [];

  if (flagCriteria.length > 0) {
    const classMeanFlags = classes.map(cls =>
      cls.length ? cls.reduce((sum, s) => sum + flagCriteria.reduce((fs, { key }) => fs + (s[key] ? 1 : 0), 0), 0) / cls.length : 0
    );
    const cfMean = classMeanFlags.reduce((a, b) => a + b, 0) / numClasses;
    const cfSd = Math.sqrt(classMeanFlags.reduce((s, v) => s + (v - cfMean) ** 2, 0) / numClasses);
    compositeItems.push({ label: 'Total Flags', vals: classMeanFlags, maxVal: Math.max(...classMeanFlags, 0.01), cv: cfMean > 0 ? cfSd / cfMean : 0 });
  }

  if (numericCriteria.length > 0) {
    const allTotalScores = students.map(studentScoreStrip);
    const popMin = Math.min(...allTotalScores);
    const popMax = Math.max(...allTotalScores);
    const popRange = popMax - popMin || 1;
    const popMean = allTotalScores.reduce((a, b) => a + b, 0) / allTotalScores.length;
    const popVar = allTotalScores.reduce((s, v) => s + (v - popMean) ** 2, 0) / allTotalScores.length;
    const classMeanScores = classes.map(cls =>
      cls.length ? cls.reduce((sum, s) => sum + studentScoreStrip(s), 0) / cls.length : popMean
    );
    const csMean = classMeanScores.reduce((a, b) => a + b, 0) / numClasses;
    const varOfMeans = classMeanScores.reduce((s, v) => s + (v - csMean) ** 2, 0) / numClasses;
    const cv = popVar > 0 ? Math.sqrt(varOfMeans / popVar) : 0;
    compositeItems.push({ label: 'Total Score', vals: classMeanScores.map(v => Math.max(0, (v - popMin) / popRange)), maxVal: 1, cv });
  }

  const allItems = [...numItems, ...boolItems, ...compositeItems];

  return (
    <div className="stats-strip">
      {allItems.map(item => (
        <div key={item.label} className="stat-item">
          <div className="stat-item-label">{item.label}</div>
          {barGroup(item.vals, item.maxVal)}
          <div className={`stat-variance ${varianceClass(item.cv)}`}>
            CV {(item.cv * 100).toFixed(1)}%
          </div>
        </div>
      ))}
    </div>
  );
}
