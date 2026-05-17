/**
 * HelpModal - Display help information about optimization
 *
 * Uses contexts:
 * - useCriteria: To show configured criteria
 *
 * @param {Object} props
 * @param {Function} props.onClose - Close callback
 */
function HelpModal({ onClose }) {
  const { numericCriteria, flagCriteria } = useCriteriaExport();
  return (
    <Modal isOpen={true} onClose={onClose} title="How It Works" size="lg">
      <div className="help-section">
        <h3>What This Tool Does</h3>
        <p>
          This tool creates balanced class lists by distributing students evenly across classes. It considers academic scores, intervention flags, and gender to ensure every class has a similar mix of students.
        </p>
        <p>
          <strong>Results are repeatable and defensible.</strong> The same data always produces the same result. Results are ready almost instantly.
        </p>
      </div>

      <div className="help-section">
        <h3>What Gets Balanced</h3>
        <p>
          The optimizer balances each factor <strong>individually</strong> (each score and flag on its own) and <strong>combined</strong> (overall totals to prevent any class from being overloaded).
        </p>
        <table className="help-table">
          <thead>
            <tr>
              <th>Factor</th>
              <th>Type</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {numericCriteria.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td>Score</td>
                <td>{m.weight.toFixed(1)}</td>
              </tr>
            ))}
            {flagCriteria.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td>Flag</td>
                <td>{m.weight.toFixed(1)}</td>
              </tr>
            ))}
            <tr>
              <td>Total Flags</td>
              <td>Combined</td>
              <td>2.0</td>
            </tr>
            <tr>
              <td>Total Score</td>
              <td>Combined</td>
              <td>1.5</td>
            </tr>
            <tr>
              <td>Gender</td>
              <td>Balance</td>
              <td>1.0</td>
            </tr>
            <tr>
              <td>Class Size</td>
              <td>Count</td>
              <td>3.0</td>
            </tr>
          </tbody>
        </table>
        <p>
          <strong>How it works:</strong> Scores use class averages (e.g., each class has a similar average reading score). Flags use percentages (e.g., if 20% of students have a behavior flag, each class gets close to 20%). Total flags and scores act as safety nets to catch overall imbalances.
        </p>
      </div>

      <div className="help-section">
        <h3>Built-In Settings</h3>
        <p>These behaviors are always applied and cannot be changed:</p>
        <p>
          <strong>Gender and class size are always balanced.</strong> Every class will have similar boy/girl ratios and counts (within 1 student).
        </p>
        <p>
          <strong>Total flags have higher priority than individual flags.</strong> This prevents a class from having too many flagged students overall.
        </p>
      </div>

      <div className="help-section">
        <h3>Balance Score</h3>
        <p>
          After optimizing, you will see a <strong>Balance Score</strong>. Lower is better (like golf). There is no "perfect" score to aim for — use it to compare different arrangements.
        </p>
      </div>

      <div className="help-section">
        <h3>Constraints</h3>
        <p>
          Set rules for specific students. These are strong preferences, not guarantees:
        </p>
        <p>
          <strong>Keep Apart:</strong> Two students who should not be in the same class.
        </p>
        <p>
          <strong>Keep Together:</strong> Two students who should be in the same class.
        </p>
        <p>
          <strong>Keep Out of Class:</strong> A student who must not be in a specific class.
        </p>
        <p>
          If honoring a constraint would make classes severely unbalanced, the tool may override it. Use <strong>locked students</strong> for absolute requirements.
        </p>
      </div>

      <div className="help-section">
        <h3>Locked Students</h3>
        <p>
          Lock students to specific classes before optimizing. The tool will not move locked students. Use this for non-negotiable placements (e.g., a student who must be with a specific teacher). Lock sparingly... the more you lock, the harder it is to find a good balance.
        </p>
      </div>
    </Modal>
  );
}
