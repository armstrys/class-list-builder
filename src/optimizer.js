function computeCost(students, assignment, numClasses, numericCriteria, flagCriteria) {
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
  cost += 1.0 * gVariance;

  // Total flags balance: variance of mean total flags per class
  const studentTotalFlags = students.map(s =>
    flagCriteria.reduce((sum, { key }) => sum + (s[key] ? 1 : 0), 0)
  );
  const overallMeanTotalFlags = studentTotalFlags.reduce((a, b) => a + b, 0) / studentTotalFlags.length;
  const classMeanTotalFlags = classes.map(cls => {
    if (!cls.length) return overallMeanTotalFlags;
    const total = cls.reduce((sum, s) => {
      const tf = flagCriteria.reduce((fSum, { key }) => fSum + (s[key] ? 1 : 0), 0);
      return sum + tf;
    }, 0);
    return total / cls.length;
  });
  const tfVariance = classMeanTotalFlags.reduce((s, m) => s + (m - overallMeanTotalFlags) ** 2, 0) / numClasses;
  cost += 2.0 * tfVariance;

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
    zScoreMeans.reduce((sum, { key, mean, stdDev }) => {
      if (stdDev === 0) return sum;
      return sum + ((s[key] || 0) - mean) / stdDev;
    }, 0)
  );
  const overallMeanTotalScore = studentTotalScores.reduce((a, b) => a + b, 0) / studentTotalScores.length;
  const classMeanTotalScores = classes.map(cls => {
    if (!cls.length) return overallMeanTotalScore;
    const total = cls.reduce((sum, s) => {
      const ts = zScoreMeans.reduce((tsSum, { key, mean, stdDev }) => {
        if (stdDev === 0) return tsSum;
        return tsSum + ((s[key] || 0) - mean) / stdDev;
      }, 0);
      return sum + ts;
    }, 0);
    return total / cls.length;
  });
  const tsVariance = classMeanTotalScores.reduce((s, m) => s + (m - overallMeanTotalScore) ** 2, 0) / numClasses;
  cost += 1.5 * tsVariance;

  // Class size balance: normalized variance of sizes
  const meanSize = students.length / numClasses;
  if (meanSize > 0) {
    const sVar = classes.reduce((s, cls) => s + (cls.length - meanSize) ** 2, 0) / numClasses;
    cost += 3.0 * sVar / (meanSize * meanSize);
  }

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
function computeSeed(students, numClasses, lockedAssignments, numericCriteria, flagCriteria) {
  let hash = 2166136261;
  const fnv = (h, v) => Math.imul(h ^ v, 16777619);

  hash = fnv(hash, numClasses);

  const sortedStudents = [...students].sort((a, b) => a.id.localeCompare(b.id));
  for (const s of sortedStudents) {
    hash = fnv(hash, s.id.split('').reduce((h, c) => fnv(h, c.charCodeAt(0)), hash));
    numericCriteria.forEach(({ key }) => hash = fnv(hash, Math.floor(s[key] || 0)));
    hash = fnv(hash, s.gender === 'F' ? 1 : s.gender === 'M' ? 2 : 3);
    flagCriteria.forEach(({ key }) => hash = fnv(hash, s[key] ? 1 : 0));
  }

  const lockedIds = Object.keys(lockedAssignments).sort();
  for (const id of lockedIds) {
    hash = fnv(hash, id.split('').reduce((h, c) => fnv(h, c.charCodeAt(0)), hash));
    hash = fnv(hash, lockedAssignments[id]);
  }

  return hash >>> 0;
}

function optimize(students, numClasses, lockedAssignments = {}, numericCriteria, flagCriteria) {
  if (!students.length || !numClasses) return {};
  const unlocked = students.filter(s => lockedAssignments[s.id] === undefined);

  const seed = computeSeed(students, numClasses, lockedAssignments, numericCriteria, flagCriteria);
  const rand = createSeededRNG(seed);

  // ── Greedy init: O(n) with running size counters ────────────────
  const scored = [...unlocked].sort((a, b) => {
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
  for (const s of scored) {
    const sScore = numericCriteria.reduce((sum, { key }) => sum + (s[key] || 0), 0);
    const minSize = Math.min(...totalSizes);
    let bestClass = 0, bestMean = Infinity;
    for (let i = 0; i < numClasses; i++) {
      if (totalSizes[i] === minSize) {
        const mean = totalSizes[i] > 0 ? greedyScoreSums[i] / totalSizes[i] : 0;
        if (mean < bestMean) { bestMean = mean; bestClass = i; }
      }
    }
    assignment[s.id] = bestClass;
    totalSizes[bestClass]++;
    greedyScoreSums[bestClass] += sScore;
  }

  // ── Pre-compute global population stats (constant throughout annealing) ──
  const nk = numericCriteria.length;
  const fk = flagCriteria.length;

  // Compute total flags per student (sum of all boolean flags)
  const studentTotalFlags = new Map();
  students.forEach(s => {
    const total = flagCriteria.reduce((sum, { key }) => sum + (s[key] ? 1 : 0), 0);
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

  // Calculate total score (sum of z-scores) for each student
  const studentTotalScore = new Map();
  students.forEach(s => {
    const totalZScore = popNumeric.reduce((sum, { key, mean, stdDev }) => {
      if (stdDev === 0) return sum; // skip if no variance
      const zScore = ((s[key] || 0) - mean) / stdDev;
      return sum + zScore;
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

  // ── Compute cost from running sums: O(numClasses × criteria) ────
  function costFromSums() {
    let cost = 0;
    popNumeric.forEach(({ mean: overallMean, popVar }, ki) => {
      const { weight } = numericCriteria[ki];
      if (popVar === 0) return;
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
    // Total flags balance: variance of mean total flags per class (weight 2.0)
    let tfVar = 0;
    for (let c = 0; c < numClasses; c++) {
      const tfMean = classSizes[c] > 0 ? classTotalFlags[c] / classSizes[c] : overallMeanTotalFlags;
      tfVar += (tfMean - overallMeanTotalFlags) ** 2;
    }
    cost += 2.0 * tfVar / numClasses;
    // Total score balance: variance of mean total score per class (weight 1.5)
    let tsVar = 0;
    for (let c = 0; c < numClasses; c++) {
      const tsMean = classSizes[c] > 0 ? classTotalScore[c] / classSizes[c] : overallMeanTotalScore;
      tsVar += (tsMean - overallMeanTotalScore) ** 2;
    }
    cost += 1.5 * tsVar / numClasses;
    if (meanSize > 0) {
      const sVar = classSizes.reduce((s, sz) => s + (sz - meanSize) ** 2, 0) / numClasses;
      cost += 3.0 * sVar / (meanSize ** 2);
    }
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
    delta += 2.0 / numClasses * (
      (newTF1 - overallMeanTotalFlags) ** 2 + (newTF2 - overallMeanTotalFlags) ** 2 -
      (oldTF1 - overallMeanTotalFlags) ** 2 - (oldTF2 - overallMeanTotalFlags) ** 2
    );
    // Total score balance (weight 1.5)
    const oldTS1 = sz1 > 0 ? classTotalScore[c1] / sz1 : overallMeanTotalScore;
    const oldTS2 = sz2 > 0 ? classTotalScore[c2] / sz2 : overallMeanTotalScore;
    const ts1 = studentTotalScore.get(s1.id);
    const ts2 = studentTotalScore.get(s2.id);
    const newTS1 = (classTotalScore[c1] - ts1 + ts2) / sz1;
    const newTS2 = (classTotalScore[c2] - ts2 + ts1) / sz2;
    delta += 1.5 / numClasses * (
      (newTS1 - overallMeanTotalScore) ** 2 + (newTS2 - overallMeanTotalScore) ** 2 -
      (oldTS1 - overallMeanTotalScore) ** 2 - (oldTS2 - overallMeanTotalScore) ** 2
    );
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
  let temp = 4.0;
  const cooling = 0.99965;
  const iters = 100000;

  for (let i = 0; i < iters; i++) {
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
    }
    temp *= cooling;
  }

  return assignment;
}
