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
    <Modal
      isOpen={true}
      onClose={onClose}
      title="How Optimization Works"
      size="lg"
    >
          <div className="help-section">
            <h3>Goal</h3>
            <p>The optimizer distributes students across classes so that every class is as similar as possible across all measured dimensions — academic scores, intervention needs, behavior, and gender balance.</p>
          </div>

          <div className="help-section">
            <h3>Cost Function</h3>
            <p>A single <strong>cost score</strong> measures total imbalance. Lower is better. The optimizer finds the assignment that minimizes this cost:</p>
            <div className="help-formula">{`Cost = Σ_m  weight_m × normalized_variance_m

  For numeric scores:
    normalized_variance_m = Var(class_means) / Var(all_students)

    This ratio is scale-agnostic: a 5% spread in Reading Score
    contributes the same as a 5% spread in Language Score.

  For binary flags (Behavior, Extended Learning, SPED, …):
    normalized_variance_m = Var(class_proportions)

  For total flags (composite):
    normalized_variance = Var(mean_total_flags_per_class)
    (penalizes one teacher getting many flagged students)

  For total score (composite):
    normalized_variance = Var(mean_zscore_sum_per_class)
    (uses z-score normalization to balance overall academic strength)

  For gender balance:
    term = Var(female_proportion per class)

  For class size:
    term = 3.0 × Var(class_sizes) / mean_size²`}</div>
          </div>

          <div className="help-section">
            <h3>Metric Weights</h3>
            <table className="help-table">
              <thead>
                <tr><th>Metric</th><th>Type</th><th>Weight</th></tr>
              </thead>
              <tbody>
                {numericCriteria.map(m => (
                  <tr key={m.key}><td>{m.label}</td><td>Numeric</td><td>{m.weight.toFixed(1)}</td></tr>
                ))}
                {flagCriteria.map(m => (
                  <tr key={m.key}><td>{m.label}</td><td>Boolean</td><td>{m.weight.toFixed(1)}</td></tr>
                ))}
                <tr><td>Total Flags</td><td>Composite</td><td>2.0</td></tr>
                <tr><td>Total Score</td><td>Composite</td><td>1.5</td></tr>
                <tr><td>Gender</td><td>Proportion</td><td>1.0</td></tr>
                <tr><td>Class Size</td><td>Count</td><td>3.0</td></tr>
              </tbody>
            </table>
          </div>

          <div className="help-section">
            <h3>Algorithm: Simulated Annealing</h3>
            <p>Starting from a snake-draft greedy initialization, the optimizer runs <strong>10,000 iterations</strong> of random student swaps. It accepts any swap that lowers the cost, and occasionally accepts slightly worse swaps to escape local optima.</p>
          </div>

          <div className="help-section">
            <h3>Locked Students</h3>
            <p>Locking a student pins them to their current class. Subsequent optimization only moves unlocked students. Use this for overrides.</p>
          </div>
    </Modal>
  );
}
