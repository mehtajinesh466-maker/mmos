const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const manualMappings = {
  "vihaan dam": "CREATE_NEW",
  "visha garg": "Viha Garg",
  "namish chandpara": "Namah Chandpara",
  "ayaan saraf": "Avyaan Saraf",
  "joshua lemke": "Joschua Lemke",
  "aanya jain": "Aavya Jain",
  "faras ghenas": "Faras Gherras",
  "ibrahim koudemagh": "Ibrahim Boudenagh",
  "ilyes ghennas": "Ilyes Gherras",
  "skylym saxena": "Skylyn Saxena",
  "kyra gupta": "Kyna Gupta",
  "prisha gupta": "Preksha Gupta",
  "zarah alwin": "zarah Allwin",
  "adam draidi": "CREATE_NEW",
  "marah draidi": "CREATE_NEW",
  "noyan senguen": "Noyan Seuguen",
  "dhriityk raipancholia": "Dhritiyk Raipancholia",
  "ammar aloem": "Ammar Aleem",
  "yushav aloem": "Yushav Aleem",
  "mohika jhunjhunwala": "Mehika Jhunjhunwala",
  "nora ajanjan": "Nora Ajanjah",
  "bodhi chordia": "Bodhi  Chokdia",
  "roya yousef": "rova yousef"
};

const siblingGroups = [
  ["Evaana Jamshidzadeh", "Kiyaana Jamshidzadeh"],
  ["Anika Iyer", "Zarah Iyer"],
  ["Kiaan Gupta", "Miraya Gupta"],
  ["Abigail Gonsalves", "Avishai Gonsalves"],
  ["Nyra jain", "Vihaan Dam"],
  ["Myra Bhandari", "Pranshi Kulshrestha"],
  ["Eva Ghannaj", "Yana Ghannaj"],
  ["Dhanya Garg", "Vedant Garg"],
  ["Misha Garg", "Visha Garg"],
  ["Abhijay Singh Matharu", "Abhiraj Singh Matharu", "Vihaan Singh Matharu"],
  ["Alena Gordina", "Mikhail Gordina"],
  ["Aadi Jain", "Shrey Jain"],
  ["Keyan Kanodia", "Mivaan Anuraag Mehta", "Namah Chandpara", "Tapish Kanodia"],
  ["Vince Charlie Peralta", "Yohann Charles Peralta"],
  ["Ayaan Saraf", "Shaarvi Saraf"],
  ["Aarya Shah", "Darsh Shah"],
  ["Aaryav Rodrigues", "Ronav Rodrigues"],
  ["Kabir Shrivastava", "Shaan Shrivastava"],
  ["Kavya Shah", "Yuvaan Shah"],
  ["Joshua Lemke", "Lilah Lemke"],
  ["Tiya Mundhra", "Yatharth Mundhra"],
  ["Aarika", "Adheesha"],
  ["Asher Ashish", "Ashton Ashish"],
  ["Emmanuel kamel", "Karas kamel"],
  ["Aryaveer Bhagat", "Rajveer Bhagat"],
  ["Aanya Jain", "Advay Jain"],
  ["Jan Kulczycka", "Weronika Kulczycka"],
  ["Daniil Apostolov", "vadim apostolov"],
  ["Faras Ghenas", "Ibrahim Koudemagh", "Ilyes Ghennas"],
  ["Skyler Saxena", "Skylym Saxena"],
  ["Finn Lyndon", "kian lyndon"],
  ["Aadya saxena", "Aarya Saxena"],
  ["Andreas Papadouris", "elene"],
  ["Kyra Gupta", "Prisha Gupta"],
  ["Subhadra", "zarah Alwin"],
  ["Khai Rajguru", "Zen Rajguru"],
  ["Mihails Filipjonoks", "Simon Filipjonoks"],
  ["Adam Draidi", "Marah Draidi", "Mihail Senguen", "Noyan Senguen"],
  ["Dhriityk Raipancholia", "Kaartik Raipancholia"],
  ["Ammar Aloem", "Yushav Aloem"],
  ["Luna Ozornek", "Maya Ozornek"],
  ["Aarna Bansal", "Sudiksha Khandelwal"],
  ["Kush", "TARA"],
  ["Dishita Jhunjhunwala", "Mohika Jhunjhunwala"],
  ["Rishik Kumar", "Vihaan Kumar"],
  ["Adam Al Sawaf", "Alexander Al Sawaf"],
  ["Lara Shembesh", "Omar Shembesh"],
  ["Evelyn", "Roslyn"],
  ["Aayansh", "Rivah"],
  ["Aashray Mittal", "Shaivi Mittal"],
  ["Khalid Alaryan", "Yousef Alaryan"],
  ["Rayan Pietrek", "Taliyah Pietrek"],
  ["Eva Ajanjan", "Nora Ajanjan"],
  ["Amit Chordia", "Bodhi Chordia", "Vanya Chordia"],
  ["Adam Afzal Dar", "Ali Afzal Dar"],
  ["Isha Sawlani", "Rhea Sawlani"],
  ["Nikita Sheth", "Nyra Sheth"],
  ["Rudra Bajaj", "Shiva Bajaj", "Veer Bajaj"],
  ["Vasilisa", "Vladimir"],
  ["Muhab Yousef", "nedal yousef", "noor yousef", "roya yousef"]
];

function cleanName(name) {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\(jlt\)/g, '').trim();
}

async function main() {
  const dbStudents = await prisma.student.findMany();
  console.log(`Fetched ${dbStudents.length} students from the database.`);

  const studentMap = new Map();
  dbStudents.forEach(s => {
    studentMap.set(cleanName(s.name), s);
  });

  let newStudentsCount = 0;
  let linkedStudentsCount = 0;

  for (let i = 0; i < siblingGroups.length; i++) {
    const group = siblingGroups[i];
    console.log(`Processing Group ${i + 1}: ${group.join(', ')}`);

    let familyId = null;
    let matchedDbStudents = [];
    let studentsToCreate = [];

    // Match or mark for creation
    for (const name of group) {
      const clean = cleanName(name);
      let matchName = name;
      
      if (manualMappings[clean]) {
        if (manualMappings[clean] === "CREATE_NEW") {
          studentsToCreate.push(name);
          continue;
        } else {
          matchName = manualMappings[clean];
        }
      }

      const cleanMatch = cleanName(matchName);
      if (studentMap.has(cleanMatch)) {
        matchedDbStudents.push(studentMap.get(cleanMatch));
      } else {
        // Try substring match
        let found = null;
        for (const [cName, s] of studentMap.entries()) {
          if (cName.includes(cleanMatch) || cleanMatch.includes(cName)) {
            found = s;
            break;
          }
        }
        if (found) {
          matchedDbStudents.push(found);
        } else {
          console.log(`  Warning: Could not match student "${name}", marking for creation.`);
          studentsToCreate.push(name);
        }
      }
    }

    // Determine the single Family ID to use/create
    const existingFamilies = matchedDbStudents
      .map(s => s.family_id)
      .filter(id => id !== null);

    if (existingFamilies.length > 0) {
      // Use the first family ID
      familyId = existingFamilies[0];
    } else {
      // Create a new Family record
      const parentName = matchedDbStudents.length > 0 
        ? (matchedDbStudents[0].parent_name || `Parent of ${matchedDbStudents[0].name}`)
        : `Parent of ${group[0]}`;
        
      const newFam = await prisma.family.create({
        data: {
          primary_name: parentName,
          phone: null,
          email: null
        }
      });
      familyId = newFam.id;
      console.log(`  Created new family for group: "${parentName}" (ID: ${familyId})`);
    }

    // Link existing students to the family
    for (const student of matchedDbStudents) {
      if (student.family_id !== familyId) {
        await prisma.student.update({
          where: { id: student.id },
          data: { family_id: familyId }
        });
        linkedStudentsCount++;
      }
    }

    // Create and link missing students
    const referenceCentreId = matchedDbStudents.length > 0
      ? matchedDbStudents[0].centre_id
      : (await prisma.centre.findFirst()).id;

    for (const name of studentsToCreate) {
      const newStudent = await prisma.student.create({
        data: {
          name: name,
          family_id: familyId,
          centre_id: referenceCentreId,
          level: 'Beginner',
          status: 'active',
          join_date: new Date(),
          pace_status: 'On track',
          flags: {}
        }
      });
      newStudentsCount++;
      console.log(`  Created missing sibling student: "${name}" at centre ${referenceCentreId}`);
    }
  }

  // Final cleanup: delete any families that have no students
  const allFamilies = await prisma.family.findMany({
    include: { students: true }
  });
  
  let deletedFamiliesCount = 0;
  for (const fam of allFamilies) {
    if (fam.students.length === 0) {
      await prisma.family.delete({
        where: { id: fam.id }
      });
      deletedFamiliesCount++;
    }
  }

  console.log(`\nSibling Seeding Complete:`);
  console.log(`Total new students created: ${newStudentsCount}`);
  console.log(`Total existing students linked/merged: ${linkedStudentsCount}`);
  console.log(`Total empty families cleaned up: ${deletedFamiliesCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
