let _sid = 1;
function uid() { return 'S' + (_sid++).toString().padStart(3, '0'); }

const FN_F = ['Emma','Olivia','Ava','Sophia','Isabella','Mia','Luna','Harper','Nora','Riley','Zoey','Lily','Hannah','Elena','Maya','Chloe','Leah','Zoe','Aria','Camila','Grace','Ellie','Violet','Aurora','Scarlett','Emily','Madison','Penelope','Layla','Stella'];
const FN_M = ['Liam','Noah','Oliver','Elijah','James','William','Lucas','Henry','Mason','Ethan','Daniel','Logan','Owen','Leo','Dylan','Nathan','Carter','Julian','Jayden','Aiden','Sebastian','Benjamin','Alexander','Michael','Matthew','Samuel','David','Joseph','Jack','Wyatt'];
const LN = ['Smith','Johnson','Williams','Brown','Davis','Miller','Wilson','Moore','Taylor','Anderson','Thomas','Jackson','White','Harris','Martin','Thompson','Garcia','Martinez','Lewis','Walker','Hall','Allen','Young','King','Wright','Clark','Rodriguez','Lopez','Hill','Adams','Nelson','Baker'];

function rnd(a, b) { return Math.round(a + Math.random() * (b - a)); }
function p(prob) { return Math.random() < prob; }

function generateSampleStudents(count = 27, numericCriteria, flagCriteria) {
  const students = [];
  for (let i = 0; i < count; i++) {
    const gender = p(0.5) ? 'F' : 'M';
    const fn = gender === 'F' ? FN_F[i % FN_F.length] : FN_M[i % FN_M.length];
    const ln = LN[i % LN.length];

    const gt = p(0.13);
    const sped = p(0.11);
    const ell = p(0.14);
    const behavior = p(0.10);

    // Generate scores based on criteria
    const student = {
      id: uid(),
      name: `${fn} ${ln}`,
      gender,
    };

    // Generate numeric scores
    numericCriteria.forEach(({ key }) => {
      const base = gt ? rnd(80, 100) : sped ? rnd(40, 65) : rnd(60, 90);
      student[key] = Math.max(0, Math.min(100, base + rnd(-10, 10)));
    });

    // Generate boolean flags
    const flag504 = p(0.07) && !sped;
    const readingIntervention = p(0.18) && !gt;
    const mathIntervention = p(0.16) && !gt;

    flagCriteria.forEach(({ key }) => {
      if (key === 'extendedlearning') student[key] = gt;
      else if (key === 'sped') student[key] = sped;
      else if (key === 'behavior') student[key] = behavior;
      else if (key === '_504') student[key] = flag504;
      else if (key === 'readingintervention') student[key] = readingIntervention;
      else if (key === 'mathintervention') student[key] = mathIntervention;
      else if (key === 'englishlanguagelearning') student[key] = ell;
      else if (key === 'medicalplan') student[key] = p(0.06);
      else student[key] = p(0.15);
    });

    students.push(student);
  }
  return students;
}

/**
 * Generate random non-conflicting constraints for sample/demo data.
 * Ensures no student is in both keepApart and keepTogether,
 * and no keepTogether group conflicts with keepOutOfClass.
 *
 * @param {Array} students - Array of student objects with id
 * @param {number} numClasses - Number of classes
 * @returns {Object} { keepApart, keepTogether, keepOutOfClass }
 */
function generateSampleConstraints(students, numClasses) {
  if (students.length < 4 || numClasses < 2) {
    return { keepApart: [], keepTogether: [], keepOutOfClass: [] };
  }

  const ids = students.map(s => s.id);
  const keepApart = [];
  const keepTogether = [];
  const keepOutOfClass = [];

  // Track which students are in keepTogether groups (to avoid keepApart conflicts)
  const inKeepTogether = new Set();

  // Generate 2-4 keepTogether groups (2-3 students each)
  const numTogetherGroups = Math.min(rnd(2, 4), Math.floor(students.length / 3));
  const availableForTogether = [...ids];
  shuffleArray(availableForTogether);

  for (let g = 0; g < numTogetherGroups && availableForTogether.length >= 2; g++) {
    const groupSize = Math.min(rnd(2, 3), availableForTogether.length);
    const group = availableForTogether.splice(0, groupSize).sort();
    keepTogether.push(group);
    group.forEach(id => inKeepTogether.add(id));
  }

  // Generate 3-6 keepApart pairs from students NOT in keepTogether
  const availableForApart = ids.filter(id => !inKeepTogether.has(id));
  shuffleArray(availableForApart);
  const numApartPairs = Math.min(rnd(3, 6), Math.floor(availableForApart.length / 2));

  for (let i = 0; i < numApartPairs && availableForApart.length >= 2; i++) {
    const id1 = availableForApart.pop();
    const id2 = availableForApart.pop();
    const pair = id1 < id2 ? [id1, id2] : [id2, id1];
    keepApart.push(pair);
  }

  // Generate 2-4 keepOutOfClass constraints
  // Pick students not in keepTogether (to avoid conflicts)
  const availableForOut = ids.filter(id => !inKeepTogether.has(id));
  shuffleArray(availableForOut);
  const numOutConstraints = Math.min(rnd(2, 4), availableForOut.length);

  for (let i = 0; i < numOutConstraints && availableForOut.length > 0; i++) {
    const studentId = availableForOut.pop();
    const classIndex = rnd(0, numClasses - 1);
    keepOutOfClass.push({ studentId, classIndex });
  }

  return { keepApart, keepTogether, keepOutOfClass };
}

/** Fisher-Yates shuffle */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
