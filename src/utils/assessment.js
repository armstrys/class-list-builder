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
let _computeCost, _optimize;
if (typeof module !== 'undefined' && module.exports) {
  const optimizer = require('../optimizer.js');
  _computeCost = optimizer.computeCost;
  _optimize = optimizer.optimize;
}

// Use global functions in browser, imported functions in Node
const computeCostRef = typeof computeCost !== 'undefined' ? computeCost : _computeCost;
const optimizeRef = typeof optimize !== 'undefined' ? optimize : _optimize;

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
 * Runs the optimizer with no constraints and no locked students.
 *
 * @param {Array<Object>} students - All student objects
 * @param {number} numClasses - Total number of classes
 * @param {Array<{key: string, weight: number}>} numericCriteria - Numeric criteria with weights
 * @param {Array<{key: string, weight: number}>} flagCriteria - Flag criteria with weights
 * @returns {number} Cost of the unconstrained optimal assignment
 */
function computeBaselineBalanced(students, numClasses, numericCriteria, flagCriteria) {
  if (!students.length || !numClasses) return 0;

  // Run optimizer with zero constraints
  const assignment = optimizeRef(
    students,
    numClasses,
    {}, // no locked assignments
    numericCriteria,
    flagCriteria,
    [], // keepApart
    [], // keepTogether
    []  // keepOutOfClass
  );

  return computeCostRef(students, assignment, numClasses, numericCriteria, flagCriteria, [], [], []);
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

  // Normalize score: 100 = as good as balanced, 0 = as good as random
  // Lower cost is better. If balanced >= random, the optimizer isn't working.
  const range = randomCost - balancedCost;
  let score = 0;
  if (range > 0) {
    // currentCost should be between balancedCost (best) and randomCost (worst)
    // If currentCost < balancedCost, something is wrong (score > 100)
    // If currentCost > randomCost, something is wrong (score < 0)
    score = ((randomCost - currentCost) / range) * 100;
  } else if (range < 0) {
    // Balanced is worse than random — this shouldn't happen
    console.warn('Assessment: balanced cost is worse than random cost', { balancedCost, randomCost });
    score = 100; // Assume perfect
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  return {
    score: Math.round(score * 10) / 10,
    currentCost: Math.round(currentCost * 1000) / 1000,
    balancedCost: Math.round(balancedCost * 1000) / 1000,
    randomCost: Math.round(randomCost * 1000) / 1000,
    classStats,
    ready: true,
  };
}

// Export for Node.js testing (conditional to not break browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeClassStats, computeBaselineBalanced, computeBaselineRandom, runFullAssessment };
}
