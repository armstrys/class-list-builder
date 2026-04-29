let _sid = 1;
function uid() { return 'S' + (_sid++).toString().padStart(3, '0'); }

const FN_F = ['Emma','Olivia','Ava','Sophia','Isabella','Mia','Luna','Harper','Nora','Riley','Zoey','Lily','Hannah','Elena','Maya','Chloe','Leah','Zoe','Aria','Camila','Grace','Ellie','Violet','Aurora','Scarlett','Emily','Madison','Penelope','Layla','Stella'];
const FN_M = ['Liam','Noah','Oliver','Elijah','James','William','Lucas','Henry','Mason','Ethan','Daniel','Logan','Owen','Leo','Dylan','Nathan','Carter','Julian','Jayden','Aiden','Sebastian','Benjamin','Alexander','Michael','Matthew','Samuel','David','Joseph','Jack','Wyatt'];

function rnd(a, b) { return Math.round(a + Math.random() * (b - a)); }
function p(prob) { return Math.random() < prob; }

function generateSampleStudents(count = 27, numericCriteria, flagCriteria) {
  const students = [];
  for (let i = 0; i < count; i++) {
    const gender = p(0.5) ? 'F' : 'M';
    const name = gender === 'F' ? FN_F[i % FN_F.length] : FN_M[i % FN_M.length];

    const gt = p(0.13);
    const sped = p(0.11);
    const ell = p(0.14);
    const behavior = p(0.10);

    // Generate scores based on criteria
    const student = {
      id: uid(),
      name,
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
      if (key === 'extendedLearning') student[key] = gt;
      else if (key === 'sped') student[key] = sped;
      else if (key === 'behavior') student[key] = behavior;
      else if (key === '504') student[key] = flag504;
      else if (key === 'readingIntervention') student[key] = readingIntervention;
      else if (key === 'mathIntervention') student[key] = mathIntervention;
      else if (key === 'englishLanguageLearning') student[key] = ell;
      else if (key === 'medicalPlan') student[key] = p(0.06);
      else student[key] = p(0.15);
    });

    students.push(student);
  }
  return students;
}
