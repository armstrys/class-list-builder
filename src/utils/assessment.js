/**
 * Assessment Engine - Compute class statistics and baseline comparisons.
 *
 * Provides:
 * - computeClassStats: per-class aggregate statistics (means for all criteria)
 * - computeBaselineBalanced: unconstrained optimal assignment (theoretical ceiling)
 * - computeBaselineRandom: mean cost across random assignments
 * - runFullAssessment: async orchestrator returning normalized 0-100 score
 */

// Node.js imports for testing
let _computeCost, _optimize, _restarts;
if (typeof module !== 'undefined' && module.exports) {
  const optimizer = require('../optimizer.js');
  _computeCost = optimizer.computeCost;
  _optimize = optimizer.optimize;
  _restarts = optimizer.OPTIMIZE_RESTARTS;
}

// Use global functions in browser, imported functions in Node
const computeCostRef = typeof computeCost !== 'undefined' ? computeCost : _computeCost;
const optimizeRef = typeof optimize !== 'undefined' ? optimize : _optimize;
// Shared with optimizeMultiStart so the baseline and the app's own optimize
// run the identical search. If these drift, an unconstrained assignment can
// no longer score 100.
const RESTARTS_REF = typeof OPTIMIZE_RESTARTS !== 'undefined' ? OPTIMIZE_RESTARTS : _restarts;

/**
 * Compute per-class aggregate statistics.
 * Returns means for all criteria (numeric and flags).
 *
 * @param {Array<Object>} students - All student objects
 * @param {Object<string, number>} assignment - studentId -> classIndex
 * @param {number} numClasses - Total number of classes
 * @param {Array<{key: string, label: string}>} numericCriteria - Numeric criteria config
 * @param {Array<{key: string, label: string}>} flagCriteria - Flag criteria config
 * @returns {Array<Object>} Per-class statistics
 */
function computeClassStats(students, assignment, numClasses, numericCriteria, flagCriteria) {
  if (!students.length || !numClasses) return [];

  const classes = Array.from({ length: numClasses }, (_, i) =>
    students.filter(s => assignment[s.id] === i)
  );

  return classes.map((cls, classIndex) => {
    const numericStats = numericCriteria.map(({ key, label }) => {
      const vals = cls.map(s => s[key] || 0);
      const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { key, label, mean: Math.round(mean * 10) / 10 };
    });

    const flagStats = flagCriteria.map(({ key, label }) => {
      const count = cls.filter(s => s[key]).length;
      const mean = cls.length ? count / cls.length : 0;
      return { key, label, count, mean: Math.round(mean * 100) / 100 };
    });

    const totalFlags = flagCriteria.reduce((sum, { key }) =>
      sum + cls.filter(s => s[key]).length, 0
    );

    return {
      classIndex,
      studentCount: cls.length,
      mCount: cls.filter(s => s.gender === 'M').length,
      fCount: cls.filter(s => s.gender === 'F').length,
      uCount: cls.filter(s => !s.gender || s.gender === 'U').length,
      numericStats,
      flagStats,
      totalFlags,
      totalFlagsMean: cls.length ? totalFlags / cls.length : 0,
    };
  });
}

/**
 * Compute the unconstrained optimal baseline.
 *
 * Runs the optimizer N times with different seed salts and returns the lowest
 * cost found. A single SA run can land at a worse local minimum than the
 * user's constrained assignment by chance, which would produce a score of 100
 * for assignments that aren't actually optimal. Multi-start tightens the
 * baseline by exploring N independent trajectories.
 *
 * @param {Array<Object>} students - All student objects
 * @param {number} numClasses - Total number of classes
 * @param {Array<{key: string, weight: number}>} numericCriteria - Numeric criteria with weights
 * @param {Array<{key: string, weight: number}>} flagCriteria - Flag criteria with weights
 * @param {number} [restarts=OPTIMIZE_RESTARTS] - Number of independent SA runs; lowest cost wins
 * @returns {number} Lowest cost across all restarts
 */
function computeBaselineBalanced(students, numClasses, numericCriteria, flagCriteria, restarts = RESTARTS_REF) {
  if (!students.length || !numClasses) return 0;

  // Fail closed. An unresolvable restart count (OPTIMIZE_RESTARTS not visible
  // across the script boundary) used to fall straight through the loop and
  // return the `Infinity` initializer. normalizeBalanceScore's defensive floor
  // then clamped the baseline to the current cost and reported a perfect 100
  // for an arbitrary assignment — a silent "everything is balanced" from a
  // baseline that never ran. Throwing surfaces the wiring error instead; the
  // caller's catch leaves the score simply absent rather than wrong.
  if (!Number.isFinite(restarts) || restarts < 1) {
    throw new Error(
      `computeBaselineBalanced: restarts must be a positive finite number, got ${restarts}. ` +
      'This usually means OPTIMIZE_RESTARTS was not resolvable — check that optimizer.js is ' +
      'evaluated before assessment.js.'
    );
  }

  let bestCost = Infinity;
  for (let salt = 0; salt < restarts; salt++) {
    const assignment = optimizeRef(
      students,
      numClasses,
      {}, // no locked assignments
      numericCriteria,
      flagCriteria,
      [], // keepApart
      [], // keepTogether
      [], // keepOutOfClass
      salt
    );
    const cost = computeCostRef(students, assignment, numClasses, numericCriteria, flagCriteria, [], [], []);
    if (cost < bestCost) bestCost = cost;
  }

  return bestCost;
}

/**
 * Compute random assignment baseline.
 * Generates N random assignments and returns the mean cost.
 * Each student is assigned to a random class independently.
 *
 * @param {Array<Object>} students - All student objects
 * @param {number} numClasses - Total number of classes
 * @param {Array<{key: string, weight: number}>} numericCriteria - Numeric criteria with weights
 * @param {Array<{key: string, weight: number}>} flagCriteria - Flag criteria with weights
 * @param {number} numTrials - Number of random trials
 * @returns {number} Mean cost across all random assignments
 */
function computeBaselineRandom(students, numClasses, numericCriteria, flagCriteria, numTrials) {
  if (!students.length || !numClasses) return 0;

  let totalCost = 0;

  for (let t = 0; t < numTrials; t++) {
    // Generate truly random assignment: each student gets a random class
    const assignment = {};
    students.forEach(s => {
      assignment[s.id] = Math.floor(Math.random() * numClasses);
    });

    totalCost += computeCostRef(
      students,
      assignment,
      numClasses,
      numericCriteria,
      flagCriteria,
      [], [], []
    );
  }

  return totalCost / numTrials;
}

/**
 * Compute random assignment baseline asynchronously.
 * Processes trials in batches to avoid blocking the main thread.
 *
 * @param {Array<Object>} students - All student objects
 * @param {number} numClasses - Total number of classes
 * @param {Array<{key: string, weight: number}>} numericCriteria - Numeric criteria with weights
 * @param {Array<{key: string, weight: number}>} flagCriteria - Flag criteria with weights
 * @param {number} numTrials - Number of random trials
 * @param {Function} onProgress - Optional callback(completed, total)
 * @returns {Promise<number>} Mean cost across all random assignments
 */
async function computeBaselineRandomAsync(students, numClasses, numericCriteria, flagCriteria, numTrials, onProgress) {
  if (!students.length || !numClasses) return 0;

  const BATCH_SIZE = 50; // Process 50 trials before yielding
  let totalCost = 0;
  let completed = 0;

  while (completed < numTrials) {
    const batchEnd = Math.min(completed + BATCH_SIZE, numTrials);

    for (let t = completed; t < batchEnd; t++) {
      const assignment = {};
      students.forEach(s => {
        assignment[s.id] = Math.floor(Math.random() * numClasses);
      });

      totalCost += computeCostRef(
        students,
        assignment,
        numClasses,
        numericCriteria,
        flagCriteria,
        [], [], []
      );
    }

    completed = batchEnd;

    if (onProgress) {
      onProgress(completed, numTrials);
    }

    // Yield to browser/event loop
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return totalCost / numTrials;
}

/**
 * Run the full assessment asynchronously.
 *
 * @param {Object} params
 * @param {Array<Object>} params.students - All student objects
 * @param {Object<string, number>} params.assignment - Current assignment
 * @param {number} params.numClasses - Total number of classes
 * @param {Array<{key: string, weight: number}>} params.numericCriteria - Numeric criteria
 * @param {Array<{key: string, weight: number}>} params.flagCriteria - Flag criteria
 * @param {Array<[string, string]>} params.keepApart - Keep apart constraints
 * @param {Array<string[]>} params.keepTogether - Keep together constraints
 * @param {Array<{studentId: string, classIndex: number}>} params.keepOutOfClass - Keep out constraints
 * @param {Function} params.onProgress - Optional callback(progressPercent, message)
 * @returns {Promise<Object>} Assessment result
 */
async function runFullAssessment({
  students,
  assignment,
  numClasses,
  numericCriteria,
  flagCriteria,
  keepApart = [],
  keepTogether = [],
  keepOutOfClass = [],
  onProgress,
}) {
  if (!students.length || !numClasses) {
    return {
      score: 0,
      currentCost: 0,
      balancedCost: 0,
      randomCost: 0,
      classStats: [],
      ready: false,
    };
  }

  const reportProgress = (pct, msg) => {
    if (onProgress) onProgress(pct, msg);
  };

  // Step 1: Compute current cost (with constraints)
  reportProgress(5, 'Computing current assignment cost...');
  const currentCost = computeCostRef(
    students,
    assignment,
    numClasses,
    numericCriteria,
    flagCriteria,
    keepApart,
    keepTogether,
    keepOutOfClass
  );

  // Step 2: Compute class stats
  reportProgress(10, 'Computing class statistics...');
  const classStats = computeClassStats(
    students,
    assignment,
    numClasses,
    numericCriteria,
    flagCriteria
  );

  // Step 3: Compute balanced baseline (unconstrained optimal)
  reportProgress(20, 'Computing balanced baseline...');
  const balancedCost = computeBaselineBalanced(
    students,
    numClasses,
    numericCriteria,
    flagCriteria
  );

  // Step 4: Compute random baseline (async, batched)
  reportProgress(40, 'Computing random baseline...');

  const NUM_RANDOM_TRIALS = 1000; // Fixed number of random trials

  const randomCost = await computeBaselineRandomAsync(
    students,
    numClasses,
    numericCriteria,
    flagCriteria,
    NUM_RANDOM_TRIALS,
    (completed, total) => {
      const pct = 40 + Math.floor((completed / total) * 50);
      reportProgress(pct, `Computing random baseline... ${completed}/${total}`);
    }
  );

  reportProgress(100, 'Assessment complete');

  const { score, effectiveBalancedCost } = normalizeBalanceScore({
    currentCost,
    balancedCost,
    randomCost,
  });

  return {
    score: Math.round(score * 10) / 10,
    currentCost: Math.round(currentCost * 100000) / 100000,
    balancedCost: Math.round(effectiveBalancedCost * 100000) / 100000,
    randomCost: Math.round(randomCost * 100000) / 100000,
    classStats,
    ready: true,
  };
}

/**
 * Costs below this gap are treated as equal. Typical costs are ~1e-3, so
 * 1e-9 is ~6 orders of magnitude below the values being compared — it
 * absorbs float rounding without swallowing a genuine difference.
 */
const COST_EQUALITY_EPSILON = 1e-9;

/**
 * Pure score-normalization helper. Maps the cost trio onto a 0–100 score
 * using a power-law transform, with a defensive floor that prevents a
 * stochastically-bad baseline from inflating the score above 100.
 *
 * If `currentCost < balancedCost` (the SA baseline got unlucky and landed
 * at a worse local minimum than the constrained user assignment), the
 * baseline is floored to `currentCost` and the score caps at 100. Without
 * the floor, the table would show "balanced 0.007 > current 0.005" with a
 * score of 100 — internally inconsistent.
 *
 * @param {Object} params
 * @param {number} params.currentCost
 * @param {number} params.balancedCost
 * @param {number} params.randomCost
 * @returns {{ score: number, effectiveBalancedCost: number }}
 */
function normalizeBalanceScore({ currentCost, balancedCost, randomCost }) {
  let effectiveBalancedCost = balancedCost;
  if (currentCost < balancedCost) {
    // Only a gap larger than float noise is worth reporting; an exact-tie
    // assignment (optimizeMultiStart running the same search as the
    // baseline) can land a few ULPs either side of the baseline.
    if (balancedCost - currentCost > COST_EQUALITY_EPSILON) {
      console.warn(
        'Assessment: current cost beat the baseline — applying defensive floor. ' +
        'The unconstrained SA run likely got stuck at a worse local minimum. ' +
        'Consider increasing baseline restarts.',
        { currentCost, balancedCost }
      );
    }
    effectiveBalancedCost = currentCost;
  }

  const range = randomCost - effectiveBalancedCost;
  let score = 0;

  if (range > 0) {
    // Power law with p=0.35: 1% worse than optimal → score ~80 (not ~99).
    // The p<1 curve is steep near zero, so sub-ULP float noise between two
    // arithmetically identical costs would otherwise cost several points.
    // Collapse only that noise — the tolerance is far below any real gap.
    const rawGap = currentCost - effectiveBalancedCost;
    const d = rawGap <= COST_EQUALITY_EPSILON ? 0 : rawGap;
    const normalized = Math.max(0, Math.min(1, d / range));
    const p = 0.35;
    score = (1 - Math.pow(normalized, p)) * 100;
  } else if (range < 0) {
    // Balanced is worse than random — shouldn't happen.
    console.warn('Assessment: balanced cost is worse than random cost', {
      balancedCost: effectiveBalancedCost,
      randomCost,
    });
    score = 100;
  }

  score = Math.max(0, Math.min(100, score));
  return { score, effectiveBalancedCost };
}

// Export for Node.js testing (conditional to not break browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeClassStats, computeBaselineBalanced, computeBaselineRandom, runFullAssessment, normalizeBalanceScore };
}
