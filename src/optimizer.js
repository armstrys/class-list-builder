/**
 * Compute the optimization cost for a given student assignment.
 * 
 * The cost function measures how imbalanced the class distribution is across
 * all criteria (numeric scores, flags, gender, total flags, total scores, and size).
 * Lower cost = better balanced classes.
 * 
 * @param {Array<Object>} students - Array of student objects with id, gender, and criteria properties
 * @param {Object<string, number>} assignment - Map of studentId -> classIndex
 * @param {number} numClasses - Total number of classes
 * @param {Array<{key: string, weight: number}>} numericCriteria - Numeric score criteria with weights
 * @param {Array<{key: string, weight: number}>} flagCriteria - Boolean flag criteria with weights
 * @param {Array<[string, string]>} keepApart - Pairs of student IDs that should be in different classes
 * @param {Array<string[]>} keepTogether - Groups of student IDs that should be in the same class
 * @param {Array<{studentId: string, classIndex: number}>} keepOutOfClass - Students blocked from specific classes
 * @returns {number} The total cost (lower is better)
 */

// Penalty weights reference - points to global PENALTY_WEIGHTS or uses inline defaults
// Check for global first (set by defaults.js), fall back to inline defaults
const PW = (typeof PENALTY_WEIGHTS !== 'undefined') ? PENALTY_WEIGHTS : {
  KEEP_APART: 100.0,
  KEEP_TOGETHER: 200.0,
  KEEP_OUT_OF_CLASS: 150.0,
  TOTAL_FLAGS: 2.0,
  TOTAL_SCORE: 1.5,
  CLASS_SIZE: 3.0,
  GENDER: 1.0,
};

function computeCost(students, assignment, numClasses, numericCriteria, flagCriteria, keepApart = [], keepTogether = [], keepOutOfClass = []) {
  if (!students.length || !numClasses) return 0;
  const classes = Array.from({ length: numClasses }, () => []);
  students.forEach(s => {
    const c = assignment[s.id];
    if (c !== undefined && c >= 0 && c < numClasses) classes[c].push(s);
  });

  let cost = 0;

  // Numeric metrics: variance of class means, normalized by overall population variance
  numericCriteria.forEach(({ key, weight }) => {
    const vals = students.map(s => s[key] || 0);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const popVar = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
    if (popVar === 0) return; // all identical scores — no imbalance possible
    const means = classes.map(cls =>
      cls.length ? cls.reduce((sum, s) => sum + (s[key] || 0), 0) / cls.length : mean
    );
    const varianceOfMeans = means.reduce((s, m) => s + (m - mean) ** 2, 0) / numClasses;
    cost += weight * varianceOfMeans / popVar;
  });

  // Boolean metrics: variance of proportions across classes
  flagCriteria.forEach(({ key, weight }) => {
    const overall = students.filter(s => s[key]).length / students.length;
    const props = classes.map(cls =>
      cls.length ? cls.filter(s => s[key]).length / cls.length : overall
    );
    const variance = props.reduce((s, p) => s + (p - overall) ** 2, 0) / numClasses;
    cost += weight * variance;
  });

  // Gender balance: variance of female proportion
  const overallF = students.filter(s => s.gender === 'F').length / students.length;
  const fProps = classes.map(cls =>
    cls.length ? cls.filter(s => s.gender === 'F').length / cls.length : overallF
  );
  const gVariance = fProps.reduce((s, p) => s + (p - overallF) ** 2, 0) / numClasses;
  cost += PW.GENDER * gVariance;

  // Total flags balance: variance of mean total flags per class
  // Weighted by individual flag criterion weights
  const studentTotalFlags = students.map(s =>
    flagCriteria.reduce((sum, { key, weight }) => sum + (s[key] ? weight : 0), 0)
  );
  const overallMeanTotalFlags = studentTotalFlags.reduce((a, b) => a + b, 0) / studentTotalFlags.length;
  const classMeanTotalFlags = classes.map(cls => {
    if (!cls.length) return overallMeanTotalFlags;
    const total = cls.reduce((sum, s) => {
      const tf = flagCriteria.reduce((fSum, { key, weight }) => fSum + (s[key] ? weight : 0), 0);
      return sum + tf;
    }, 0);
    return total / cls.length;
  });
  const tfVariance = classMeanTotalFlags.reduce((s, m) => s + (m - overallMeanTotalFlags) ** 2, 0) / numClasses;
  cost += PW.TOTAL_FLAGS * tfVariance;

  // Total score balance: variance of mean z-score per class
  // Calculate z-scores for each numeric criterion
  const zScoreMeans = numericCriteria.map(({ key }) => {
    const vals = students.map(s => s[key] || 0);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
    const stdDev = Math.sqrt(variance);
    return { key, mean, stdDev };
  });

  const studentTotalScores = students.map(s =>
    zScoreMeans.reduce((sum, { key, mean, stdDev }, ki) => {
      if (stdDev === 0) return sum;
      const weight = numericCriteria[ki]?.weight ?? 1.0;
      return sum + weight * ((s[key] || 0) - mean) / stdDev;
    }, 0)
  );
  const overallMeanTotalScore = studentTotalScores.reduce((a, b) => a + b, 0) / studentTotalScores.length;
  const classMeanTotalScores = classes.map(cls => {
    if (!cls.length) return overallMeanTotalScore;
    const total = cls.reduce((sum, s) => {
      const ts = zScoreMeans.reduce((tsSum, { key, mean, stdDev }, ki) => {
        if (stdDev === 0) return tsSum;
        const weight = numericCriteria[ki]?.weight ?? 1.0;
        return tsSum + weight * ((s[key] || 0) - mean) / stdDev;
      }, 0);
      return sum + ts;
    }, 0);
    return total / cls.length;
  });
  const tsVariance = classMeanTotalScores.reduce((s, m) => s + (m - overallMeanTotalScore) ** 2, 0) / numClasses;
  cost += PW.TOTAL_SCORE * tsVariance;

  // Class size balance: normalized variance of sizes
  const meanSize = students.length / numClasses;
  if (meanSize > 0) {
    const sVar = classes.reduce((s, cls) => s + (cls.length - meanSize) ** 2, 0) / numClasses;
    cost += PW.CLASS_SIZE * sVar / (meanSize * meanSize);
  }

  // Keep Apart penalty: count of constrained pairs in same class (high weight)
  const keepApartPenalty = keepApart.reduce((penalty, [id1, id2]) => {
    const c1 = assignment[id1];
    const c2 = assignment[id2];
    return (c1 !== undefined && c2 !== undefined && c1 === c2) ? penalty + 1 : penalty;
  }, 0);
  cost += PW.KEEP_APART * keepApartPenalty;

  // Keep Together penalty: count of groups split across classes (very high weight)
  // Note: This is a soft constraint - high penalty encourages togetherness but doesn't guarantee it
  const keepTogetherPenalty = keepTogether.reduce((penalty, group) => {
    if (group.length < 2) return penalty;
    const classes = new Set();
    for (const id of group) {
      const c = assignment[id];
      if (c !== undefined) classes.add(c);
    }
    // Penalty if group members are in more than 1 class
    return classes.size > 1 ? penalty + 1 : penalty;
  }, 0);
  cost += PW.KEEP_TOGETHER * keepTogetherPenalty;

  // Keep Out of Class penalty: count of students assigned to their forbidden class
  const keepOutOfClassPenalty = keepOutOfClass.reduce((penalty, { studentId, classIndex }) => {
    const assignedClass = assignment[studentId];
    return (assignedClass !== undefined && assignedClass === classIndex) ? penalty + 1 : penalty;
  }, 0);
  cost += PW.KEEP_OUT_OF_CLASS * keepOutOfClassPenalty;

  return cost;
}

// Seeded random number generator (Mulberry32) for reproducible optimization
function createSeededRNG(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Compute deterministic seed from input data
function computeSeed(students, numClasses, lockedAssignments, numericCriteria, flagCriteria, keepApart = [], keepTogether = [], keepOutOfClass = []) {
  let hash = 2166136261;
  const fnv = (h, v) => Math.imul(h ^ v, 16777619);

  hash = fnv(hash, numClasses);

  const sortedStudents = [...students].sort((a, b) => a.id.localeCompare(b.id));
  for (const s of sortedStudents) {
    hash = fnv(hash, s.id.split('').reduce((h, c) => fnv(h, c.charCodeAt(0)), hash));
    numericCriteria.forEach(({ key, weight }) => {
      hash = fnv(hash, Math.floor(s[key] || 0));
      hash = fnv(hash, Math.floor((weight || 1) * 1000)); // Include weight in seed
    });
    hash = fnv(hash, s.gender === 'F' ? 1 : s.gender === 'M' ? 2 : 3);
    flagCriteria.forEach(({ key, weight }) => {
      hash = fnv(hash, s[key] ? 1 : 0);
      hash = fnv(hash, Math.floor((weight || 1) * 1000)); // Include weight in seed
    });
  }

  const lockedIds = Object.keys(lockedAssignments).sort();
  for (const id of lockedIds) {
    hash = fnv(hash, id.split('').reduce((h, c) => fnv(h, c.charCodeAt(0)), hash));
    hash = fnv(hash, lockedAssignments[id]);
  }

  // Hash keepApart constraints for determinism
  const sortedKeepApart = [...keepApart].sort((a, b) => {
    if (a[0] !== b[0]) return a[0].localeCompare(b[0]);
    return a[1].localeCompare(b[1]);
  });
  for (const pair of sortedKeepApart) {
    hash = fnv(hash, pair[0].split('').reduce((h, c) => fnv(h, c.charCodeAt(0)), hash));
    hash = fnv(hash, pair[1].split('').reduce((h, c) => fnv(h, c.charCodeAt(0)), hash));
  }

  // Hash keepTogether constraints for determinism
  const sortedKeepTogether = [...keepTogether].map(group => [...group].sort()).sort((a, b) => {
    if (a[0] !== b[0]) return a[0].localeCompare(b[0]);
    return a[1]?.localeCompare(b[1]) || 0;
  });
  for (const group of sortedKeepTogether) {
    hash = fnv(hash, group.length);
    for (const id of group) {
      hash = fnv(hash, id.split('').reduce((h, c) => fnv(h, c.charCodeAt(0)), hash));
    }
  }

  // Hash keepOutOfClass constraints for determinism
  const sortedKeepOutOfClass = [...keepOutOfClass].sort((a, b) => {
    if (a.studentId !== b.studentId) return a.studentId.localeCompare(b.studentId);
    return a.classIndex - b.classIndex;
  });
  for (const constraint of sortedKeepOutOfClass) {
    hash = fnv(hash, constraint.studentId.split('').reduce((h, c) => fnv(h, c.charCodeAt(0)), hash));
    hash = fnv(hash, constraint.classIndex);
  }

  return hash >>> 0;
}

/**
 * Optimize student class assignments using simulated annealing.
 * 
 * Algorithm:
 * 1. Greedy initialization: Sort students by score and assign to smallest classes
 * 2. Simulated annealing: Randomly swap students to minimize cost function
 * 3. Constraint handling: High penalties for constraint violations
 * 
 * The algorithm is deterministic - same inputs always produce same outputs.
 * 
 * @param {Array<Object>} students - Array of student objects
 * @param {number} numClasses - Total number of classes
 * @param {Object<string, number>} lockedAssignments - Pre-assigned students (studentId -> classIndex)
 * @param {Array<{key: string, weight: number}>} numericCriteria - Numeric score criteria
 * @param {Array<{key: string, weight: number}>} flagCriteria - Boolean flag criteria
 * @param {Array<[string, string]>} keepApart - Pairs of students to keep apart
 * @param {Array<string[]>} keepTogether - Groups of students to keep together
 * @param {Array<{studentId: string, classIndex: number}>} keepOutOfClass - Blocked class assignments
 * @returns {Object<string, number>} Final assignment (studentId -> classIndex)
 */
function optimize(students, numClasses, lockedAssignments = {}, numericCriteria, flagCriteria, keepApart = [], keepTogether = [], keepOutOfClass = []) {
  if (!students.length || !numClasses) return {};
  const unlocked = students.filter(s => lockedAssignments[s.id] === undefined);

  const seed = computeSeed(students, numClasses, lockedAssignments, numericCriteria, flagCriteria, keepApart, keepTogether, keepOutOfClass);
  const rand = createSeededRNG(seed);

  // ── Build keep-together group membership map ────────────────
  const studentGroupMap = new Map(); // studentId -> group index
  const validKeepTogether = keepTogether.filter(group => group.length >= 2);
  validKeepTogether.forEach((group, idx) => {
    group.forEach(studentId => studentGroupMap.set(studentId, idx));
  });

  // ── Greedy init: O(n) with running size counters ────────────────
  // Sort by group (group members together) then by score
  const scored = [...unlocked].sort((a, b) => {
    const groupA = studentGroupMap.get(a.id);
    const groupB = studentGroupMap.get(b.id);

    // If both are in groups, keep groups together (sort by group index)
    if (groupA !== undefined && groupB !== undefined) {
      if (groupA !== groupB) return groupA - groupB;
    }
    // If only one is in a group, groups come first
    if (groupA !== undefined && groupB === undefined) return -1;
    if (groupA === undefined && groupB !== undefined) return 1;

    // Within same group or neither in group, sort by score
    const sa = numericCriteria.reduce((sum, { key }) => sum + (a[key] || 0), 0);
    const sb = numericCriteria.reduce((sum, { key }) => sum + (b[key] || 0), 0);
    return sb - sa;
  });

  const targetSize = students.length / numClasses;
  const totalSizes = new Array(numClasses).fill(0);
  const greedyScoreSums = new Array(numClasses).fill(0);
  const studentById = Object.fromEntries(students.map(s => [s.id, s]));
  Object.entries(lockedAssignments).forEach(([sid, c]) => {
    if (c >= 0 && c < numClasses) {
      totalSizes[c]++;
      const s = studentById[sid];
      if (s) greedyScoreSums[c] += numericCriteria.reduce((sum, { key }) => sum + (s[key] || 0), 0);
    }
  });

  const assignment = { ...lockedAssignments };

  // Track which group is assigned to which class
  const groupAssignments = new Map(); // group index -> class index

  // Process groups in random order to distribute them fairly across classes
  const groupIndices = validKeepTogether.map((_, idx) => idx);
  // Shuffle group order using seeded RNG for determinism
  for (let i = groupIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [groupIndices[i], groupIndices[j]] = [groupIndices[j], groupIndices[i]];
  }
  const groupOrderMap = new Map(groupIndices.map((idx, order) => [idx, order]));

  // Re-sort scored to process groups in randomized order
  scored.sort((a, b) => {
    const groupA = studentGroupMap.get(a.id);
    const groupB = studentGroupMap.get(b.id);

    // Both in groups - use randomized group order
    if (groupA !== undefined && groupB !== undefined) {
      if (groupA !== groupB) {
        return groupOrderMap.get(groupA) - groupOrderMap.get(groupB);
      }
      // Same group - maintain original order
      return 0;
    }
    // If only one is in a group, groups come first
    if (groupA !== undefined && groupB === undefined) return -1;
    if (groupA === undefined && groupB !== undefined) return 1;

    // Neither in group - sort by score
    const sa = numericCriteria.reduce((sum, { key }) => sum + (a[key] || 0), 0);
    const sb = numericCriteria.reduce((sum, { key }) => sum + (b[key] || 0), 0);
    return sb - sa;
  });

  for (const s of scored) {
    const sScore = numericCriteria.reduce((sum, { key }) => sum + (s[key] || 0), 0);

    let bestClass;
    const groupIdx = studentGroupMap.get(s.id);

    if (groupIdx !== undefined) {
      // Student is in a keep-together group
      if (groupAssignments.has(groupIdx)) {
        // Group already has a class assigned, use it
        bestClass = groupAssignments.get(groupIdx);
      } else {
        // First member of this group - assign to a random smallest class
        const minSize = Math.min(...totalSizes);
        const smallestClasses = [];
        for (let i = 0; i < numClasses; i++) {
          if (totalSizes[i] === minSize) {
            smallestClasses.push(i);
          }
        }
        // Randomly select from smallest classes for fairness
        bestClass = smallestClasses[Math.floor(rand() * smallestClasses.length)];
        groupAssignments.set(groupIdx, bestClass);
      }
    } else {
      // Not in a group - use normal greedy assignment
      const minSize = Math.min(...totalSizes);
      let bestMean = Infinity;
      bestClass = 0;
      for (let i = 0; i < numClasses; i++) {
        if (totalSizes[i] === minSize) {
          const mean = totalSizes[i] > 0 ? greedyScoreSums[i] / totalSizes[i] : 0;
          if (mean < bestMean) { bestMean = mean; bestClass = i; }
        }
      }
    }

    assignment[s.id] = bestClass;
    totalSizes[bestClass]++;
    greedyScoreSums[bestClass] += sScore;
  }

  // ── Pre-compute global population stats (constant throughout annealing) ──
  const nk = numericCriteria.length;
  const fk = flagCriteria.length;

  // Compute total flags per student (sum of all boolean flags, weighted by criterion weight)
  const studentTotalFlags = new Map();
  students.forEach(s => {
    const total = flagCriteria.reduce((sum, { key, weight }) => sum + (s[key] ? weight : 0), 0);
    studentTotalFlags.set(s.id, total);
  });

  // Compute z-score based total score per student (sum of z-scores across numeric criteria)
  const popNumeric = numericCriteria.map(({ key }) => {
    const vals = students.map(s => s[key] || 0);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const popVar = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
    const stdDev = Math.sqrt(popVar);
    return { key, mean, popVar, stdDev };
  });

  // Calculate total score (weighted sum of z-scores) for each student
  const studentTotalScore = new Map();
  students.forEach(s => {
    const totalZScore = popNumeric.reduce((sum, { key, mean, stdDev }, ki) => {
      if (stdDev === 0) return sum; // skip if no variance
      const zScore = ((s[key] || 0) - mean) / stdDev;
      const weight = numericCriteria[ki]?.weight ?? 1.0;
      return sum + weight * zScore;
    }, 0);
    studentTotalScore.set(s.id, totalZScore);
  });
  const popFlag = flagCriteria.map(({ key }) => ({
    key,
    overallProp: students.filter(s => s[key]).length / students.length,
  }));
  const overallF = students.filter(s => s.gender === 'F').length / students.length;
  const meanSize = students.length / numClasses;

  // Total flags distribution stats
  const allTotalFlags = students.map(s => studentTotalFlags.get(s.id));
  const overallMeanTotalFlags = allTotalFlags.reduce((a, b) => a + b, 0) / allTotalFlags.length;

  // Total score distribution stats (z-scores should sum to ~0 across population)
  const allTotalScores = students.map(s => studentTotalScore.get(s.id));
  const overallMeanTotalScore = allTotalScores.reduce((a, b) => a + b, 0) / allTotalScores.length;

  // ── Initialize per-class running sums ───────────────────────────
  const classSizes = new Array(numClasses).fill(0);
  const classNumSums = Array.from({ length: numClasses }, () => new Float64Array(nk));
  const classFlagCounts = Array.from({ length: numClasses }, () => new Int32Array(fk));
  const classFemale = new Int32Array(numClasses);
  const classTotalFlags = new Float64Array(numClasses);
  const classTotalScore = new Float64Array(numClasses);

  for (const s of students) {
    const c = assignment[s.id];
    if (c === undefined || c < 0 || c >= numClasses) continue;
    classSizes[c]++;
    popNumeric.forEach(({ key }, ki) => { classNumSums[c][ki] += s[key] || 0; });
    popFlag.forEach(({ key }, ki) => { if (s[key]) classFlagCounts[c][ki]++; });
    if (s.gender === 'F') classFemale[c]++;
    classTotalFlags[c] += studentTotalFlags.get(s.id);
    classTotalScore[c] += studentTotalScore.get(s.id);
  }

  // ── Constraint penalty calculations ─────────────────────────────
  // Centralized constraint penalty logic used by both costFromSums and swapDelta
  // Returns object with { keepApartPenalty, keepTogetherPenalty, keepOutOfClassPenalty }
  function calculateConstraintPenalties() {
    // Keep Apart penalty: count of constrained pairs in same class (high weight)
    const keepApartPenalty = keepApart.reduce((penalty, [id1, id2]) => {
      const c1 = assignment[id1];
      const c2 = assignment[id2];
      return (c1 !== undefined && c2 !== undefined && c1 === c2) ? penalty + 1 : penalty;
    }, 0);

    // Keep Together penalty: count of groups split across classes (very high weight)
    const keepTogetherPenalty = keepTogether.reduce((penalty, group) => {
      if (group.length < 2) return penalty;
      const classes = new Set();
      for (const id of group) {
        const c = assignment[id];
        if (c !== undefined) classes.add(c);
      }
      // Penalty if group members are in more than 1 class
      return classes.size > 1 ? penalty + 1 : penalty;
    }, 0);

    // Keep Out of Class penalty: count of students assigned to their forbidden class
    const keepOutOfClassPenalty = keepOutOfClass.reduce((penalty, { studentId, classIndex }) => {
      const assignedClass = assignment[studentId];
      return (assignedClass !== undefined && assignedClass === classIndex) ? penalty + 1 : penalty;
    }, 0);

    return { keepApartPenalty, keepTogetherPenalty, keepOutOfClassPenalty };
  }

  // ── Compute cost from running sums: O(numClasses × criteria) ────
  function costFromSums() {
    let cost = 0;
    popNumeric.forEach(({ mean: overallMean, popVar }, ki) => {
      const { weight } = numericCriteria[ki];
      if (popVar === 0) {
        console.warn(`Criterion "${numericCriteria[ki].key}" has zero variance (all values are identical). This criterion is being skipped in the optimization.`);
        return;
      }
      let varOfMeans = 0;
      for (let c = 0; c < numClasses; c++) {
        const m = classSizes[c] > 0 ? classNumSums[c][ki] / classSizes[c] : overallMean;
        varOfMeans += (m - overallMean) ** 2;
      }
      cost += weight * (varOfMeans / numClasses) / popVar;
    });
    popFlag.forEach(({ overallProp }, ki) => {
      const { weight } = flagCriteria[ki];
      let variance = 0;
      for (let c = 0; c < numClasses; c++) {
        const p = classSizes[c] > 0 ? classFlagCounts[c][ki] / classSizes[c] : overallProp;
        variance += (p - overallProp) ** 2;
      }
      cost += weight * variance / numClasses;
    });
    let gVar = 0;
    for (let c = 0; c < numClasses; c++) {
      const fp = classSizes[c] > 0 ? classFemale[c] / classSizes[c] : overallF;
      gVar += (fp - overallF) ** 2;
    }
    cost += gVar / numClasses;
    // Total flags balance: variance of mean total flags per class
    let tfVar = 0;
    for (let c = 0; c < numClasses; c++) {
      const tfMean = classSizes[c] > 0 ? classTotalFlags[c] / classSizes[c] : overallMeanTotalFlags;
      tfVar += (tfMean - overallMeanTotalFlags) ** 2;
    }
    cost += PW.TOTAL_FLAGS * tfVar / numClasses;
    // Total score balance: variance of mean total score per class
    let tsVar = 0;
    for (let c = 0; c < numClasses; c++) {
      const tsMean = classSizes[c] > 0 ? classTotalScore[c] / classSizes[c] : overallMeanTotalScore;
      tsVar += (tsMean - overallMeanTotalScore) ** 2;
    }
    cost += PW.TOTAL_SCORE * tsVar / numClasses;
    if (meanSize > 0) {
      const sVar = classSizes.reduce((s, sz) => s + (sz - meanSize) ** 2, 0) / numClasses;
      cost += PW.CLASS_SIZE * sVar / (meanSize ** 2);
    }
    // Constraint penalties
    const { keepApartPenalty, keepTogetherPenalty, keepOutOfClassPenalty } = calculateConstraintPenalties();
    cost += PW.KEEP_APART * keepApartPenalty;
    cost += PW.KEEP_TOGETHER * keepTogetherPenalty;
    cost += PW.KEEP_OUT_OF_CLASS * keepOutOfClassPenalty;

    return cost;
  }

  // ── O(criteria) delta for swapping s1 (in c1) with s2 (in c2) ──
  function swapDelta(s1, c1, s2, c2) {
    let delta = 0;
    popNumeric.forEach(({ key, mean: overallMean, popVar }, ki) => {
      const { weight } = numericCriteria[ki];
      if (popVar === 0) return;
      const sz1 = classSizes[c1], sz2 = classSizes[c2];
      const oldM1 = sz1 > 0 ? classNumSums[c1][ki] / sz1 : overallMean;
      const oldM2 = sz2 > 0 ? classNumSums[c2][ki] / sz2 : overallMean;
      const v1 = s1[key] || 0, v2 = s2[key] || 0;
      const newM1 = (classNumSums[c1][ki] - v1 + v2) / sz1;
      const newM2 = (classNumSums[c2][ki] - v2 + v1) / sz2;
      delta += weight / (numClasses * popVar) * (
        (newM1 - overallMean) ** 2 + (newM2 - overallMean) ** 2 -
        (oldM1 - overallMean) ** 2 - (oldM2 - overallMean) ** 2
      );
    });
    popFlag.forEach(({ key, overallProp }, ki) => {
      const { weight } = flagCriteria[ki];
      const sz1 = classSizes[c1], sz2 = classSizes[c2];
      const oldP1 = sz1 > 0 ? classFlagCounts[c1][ki] / sz1 : overallProp;
      const oldP2 = sz2 > 0 ? classFlagCounts[c2][ki] / sz2 : overallProp;
      const f1 = s1[key] ? 1 : 0, f2 = s2[key] ? 1 : 0;
      const newP1 = (classFlagCounts[c1][ki] - f1 + f2) / sz1;
      const newP2 = (classFlagCounts[c2][ki] - f2 + f1) / sz2;
      delta += weight / numClasses * (
        (newP1 - overallProp) ** 2 + (newP2 - overallProp) ** 2 -
        (oldP1 - overallProp) ** 2 - (oldP2 - overallProp) ** 2
      );
    });
    // Gender
    const sz1 = classSizes[c1], sz2 = classSizes[c2];
    const oldGP1 = sz1 > 0 ? classFemale[c1] / sz1 : overallF;
    const oldGP2 = sz2 > 0 ? classFemale[c2] / sz2 : overallF;
    const gf1 = s1.gender === 'F' ? 1 : 0, gf2 = s2.gender === 'F' ? 1 : 0;
    const newGP1 = (classFemale[c1] - gf1 + gf2) / sz1;
    const newGP2 = (classFemale[c2] - gf2 + gf1) / sz2;
    delta += 1 / numClasses * (
      (newGP1 - overallF) ** 2 + (newGP2 - overallF) ** 2 -
      (oldGP1 - overallF) ** 2 - (oldGP2 - overallF) ** 2
    );
    // Total flags balance (weight 2.0)
    const oldTF1 = sz1 > 0 ? classTotalFlags[c1] / sz1 : overallMeanTotalFlags;
    const oldTF2 = sz2 > 0 ? classTotalFlags[c2] / sz2 : overallMeanTotalFlags;
    const tf1 = studentTotalFlags.get(s1.id);
    const tf2 = studentTotalFlags.get(s2.id);
    const newTF1 = (classTotalFlags[c1] - tf1 + tf2) / sz1;
    const newTF2 = (classTotalFlags[c2] - tf2 + tf1) / sz2;
    delta += PW.TOTAL_FLAGS / numClasses * (
      (newTF1 - overallMeanTotalFlags) ** 2 + (newTF2 - overallMeanTotalFlags) ** 2 -
      (oldTF1 - overallMeanTotalFlags) ** 2 - (oldTF2 - overallMeanTotalFlags) ** 2
    );
    // Total score balance
    const oldTS1 = sz1 > 0 ? classTotalScore[c1] / sz1 : overallMeanTotalScore;
    const oldTS2 = sz2 > 0 ? classTotalScore[c2] / sz2 : overallMeanTotalScore;
    const ts1 = studentTotalScore.get(s1.id);
    const ts2 = studentTotalScore.get(s2.id);
    const newTS1 = (classTotalScore[c1] - ts1 + ts2) / sz1;
    const newTS2 = (classTotalScore[c2] - ts2 + ts1) / sz2;
    delta += PW.TOTAL_SCORE / numClasses * (
      (newTS1 - overallMeanTotalScore) ** 2 + (newTS2 - overallMeanTotalScore) ** 2 -
      (oldTS1 - overallMeanTotalScore) ** 2 - (oldTS2 - overallMeanTotalScore) ** 2
    );
    // Keep Apart delta: only changes if s1 or s2 is part of a constrained pair
    // Calculate change in penalty count after swap
    let keepApartDelta = 0;
    for (const [id1, id2] of keepApart) {
      const oldC1 = assignment[id1];
      const oldC2 = assignment[id2];
      const wasViolating = oldC1 === oldC2;
      // Determine new classes after swap
      const newC1 = (id1 === s1.id) ? c2 : (id1 === s2.id) ? c1 : oldC1;
      const newC2 = (id2 === s1.id) ? c2 : (id2 === s2.id) ? c1 : oldC2;
      const isViolating = newC1 === newC2;
      if (wasViolating && !isViolating) keepApartDelta -= 1;
      else if (!wasViolating && isViolating) keepApartDelta += 1;
    }
    delta += PW.KEEP_APART * keepApartDelta;

    // Keep Together delta: changes if swap splits or joins a group
    let keepTogetherDelta = 0;
    for (const group of keepTogether) {
      if (group.length < 2) continue;
      // Check if group is affected by this swap
      const isS1InGroup = group.includes(s1.id);
      const isS2InGroup = group.includes(s2.id);
      if (!isS1InGroup && !isS2InGroup) continue; // Group unchanged

      // Calculate old state: are all group members in the same class?
      const oldClasses = new Set();
      for (const id of group) {
        const c = assignment[id];
        if (c !== undefined) oldClasses.add(c);
      }
      const wasSplit = oldClasses.size > 1;

      // Calculate new classes after swap
      const newClasses = new Set();
      for (const id of group) {
        let c = assignment[id];
        if (id === s1.id) c = c2;
        else if (id === s2.id) c = c1;
        if (c !== undefined) newClasses.add(c);
      }
      const isSplit = newClasses.size > 1;

      // Delta: +1 if newly split, -1 if newly joined
      if (!wasSplit && isSplit) keepTogetherDelta += 1;
      else if (wasSplit && !isSplit) keepTogetherDelta -= 1;
    }
    delta += PW.KEEP_TOGETHER * keepTogetherDelta;

    // Keep Out of Class delta: changes if swap moves a student into/out of their forbidden class
    let keepOutOfClassDelta = 0;
    for (const { studentId, classIndex } of keepOutOfClass) {
      const oldClass = assignment[studentId];
      // Determine new class after swap
      const newClass = (studentId === s1.id) ? c2 : (studentId === s2.id) ? c1 : oldClass;
      const wasViolating = oldClass !== undefined && oldClass === classIndex;
      const isViolating = newClass !== undefined && newClass === classIndex;
      if (!wasViolating && isViolating) keepOutOfClassDelta += 1;
      else if (wasViolating && !isViolating) keepOutOfClassDelta -= 1;
    }
    delta += PW.KEEP_OUT_OF_CLASS * keepOutOfClassDelta;

    // Class sizes don't change in a same-depth swap
    return delta;
  }

  function applySwap(s1, c1, s2, c2) {
    popNumeric.forEach(({ key }, ki) => {
      const v1 = s1[key] || 0, v2 = s2[key] || 0;
      classNumSums[c1][ki] += v2 - v1;
      classNumSums[c2][ki] += v1 - v2;
    });
    popFlag.forEach(({ key }, ki) => {
      const f1 = s1[key] ? 1 : 0, f2 = s2[key] ? 1 : 0;
      classFlagCounts[c1][ki] += f2 - f1;
      classFlagCounts[c2][ki] += f1 - f2;
    });
    const gf1 = s1.gender === 'F' ? 1 : 0, gf2 = s2.gender === 'F' ? 1 : 0;
    classFemale[c1] += gf2 - gf1;
    classFemale[c2] += gf1 - gf2;
    // Update total flags counts
    const tf1 = studentTotalFlags.get(s1.id);
    const tf2 = studentTotalFlags.get(s2.id);
    classTotalFlags[c1] += tf2 - tf1;
    classTotalFlags[c2] += tf1 - tf2;
    // Update total score counts
    const ts1 = studentTotalScore.get(s1.id);
    const ts2 = studentTotalScore.get(s2.id);
    classTotalScore[c1] += ts2 - ts1;
    classTotalScore[c2] += ts1 - ts2;
    assignment[s1.id] = c2;
    assignment[s2.id] = c1;
  }

  let currentCost = costFromSums();

  // ── Simulated annealing: O(criteria) per iteration ──────────────
  // Use adaptive parameters based on problem size for better scaling
  const annealingParams = computeAdaptiveAnnealingParams(students.length, numClasses);
  let temp = annealingParams.temp;
  const cooling = annealingParams.cooling;
  const maxIters = annealingParams.maxIters;
  const convergenceThreshold = annealingParams.convergenceThreshold;
  const convergenceWindow = annealingParams.convergenceWindow;

  let bestCost = currentCost;
  let iterationsSinceImprovement = 0;
  
  // Log adaptive parameters for large problems (helpful for debugging)
  // eslint-disable-next-line no-console
  if (students.length > 500) {
    // eslint-disable-next-line no-console
    console.log(`[Optimizer] Problem size: ${students.length} students × ${numClasses} classes`);
    // eslint-disable-next-line no-console
    console.log(`[Optimizer] Annealing params: ${maxIters.toLocaleString()} iterations, cooling=${cooling.toFixed(5)}, window=${convergenceWindow}`);
  }

  for (let i = 0; i < maxIters; i++) {
    const i1 = Math.floor(rand() * unlocked.length);
    const i2 = Math.floor(rand() * unlocked.length);
    if (i1 === i2) continue;

    const s1 = unlocked[i1], s2 = unlocked[i2];
    const c1 = assignment[s1.id], c2 = assignment[s2.id];
    if (c1 === c2) { temp *= cooling; continue; }

    const delta = swapDelta(s1, c1, s2, c2);
    if (delta < 0 || rand() < Math.exp(-delta / temp)) {
      applySwap(s1, c1, s2, c2);
      currentCost += delta;
      
      // Track best cost for convergence detection
      if (currentCost < bestCost) {
        bestCost = currentCost;
        iterationsSinceImprovement = 0;
      } else {
        iterationsSinceImprovement++;
      }
    } else {
      iterationsSinceImprovement++;
    }
    
    temp *= cooling;
    
    // Convergence-based early exit
    if (temp < convergenceThreshold && iterationsSinceImprovement >= convergenceWindow) {
      break;
    }
  }

  return assignment;
}

/**
 * Compute adaptive annealing parameters based on problem size.
 * 
 * Scaling strategy:
 * - Base: 100k iterations for 27 students × 3 classes (problem size = 81)
 * - Scale iterations with √problemSize for larger datasets
 * - Cap iterations at 500k to prevent unreasonable runtimes
 * - Adjust cooling rate to maintain effective temperature schedule
 * - Increase convergence patience for larger search spaces
 * 
 * @param {number} numStudents - Total number of students
 * @param {number} numClasses - Total number of classes
 * @returns {Object} Annealing parameters { temp, cooling, maxIters, convergenceThreshold, convergenceWindow }
 */
function computeAdaptiveAnnealingParams(numStudents, numClasses) {
  const baseProblemSize = 81; // 27 students × 3 classes (original test case)
  const problemSize = numStudents * numClasses;
  const scaleFactor = Math.sqrt(problemSize / baseProblemSize);
  
  // Scale iterations with √problemSize, but cap at 500k for reasonable runtime
  // For 5000 students: ~333k iterations
  // For 100,000 students: capped at 500k (not 248 million!)
  const MAX_ITERATIONS = 500000;
  const scaledIters = Math.floor(100000 * scaleFactor);
  const maxIters = Math.min(scaledIters, MAX_ITERATIONS);
  
  // Slower cooling for larger problems to maintain search effectiveness
  // Use logarithmic scaling to keep cooling rate close to 1.0
  // Base: 0.99965, decreases slightly for larger problems
  const coolingAdjustment = 1 - (Math.log10(scaleFactor) * 0.0001);
  const cooling = 0.99965 * Math.max(coolingAdjustment, 0.999);
  
  // More patient convergence detection for large datasets
  // Scale with student count (not problem size) for reasonable values
  const convergenceWindow = Math.max(5000, Math.floor(numStudents * 0.3));
  
  // Slightly lower threshold for large problems to allow finer optimization
  const convergenceThreshold = 0.001 / Math.sqrt(scaleFactor);
  
  return {
    temp: 4.0,
    cooling: Math.min(cooling, 0.99995), // Cap to prevent too slow cooling
    maxIters,
    convergenceThreshold: Math.max(convergenceThreshold, 0.0001),
    convergenceWindow
  };
}

// Export for Node.js testing (conditional to not break browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { optimize, computeCost, computeSeed, createSeededRNG, computeAdaptiveAnnealingParams };
}
