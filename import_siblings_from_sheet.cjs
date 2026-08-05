const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const XLSX = require('xlsx');

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

function cleanName(name) {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\(jlt\)/g, '').trim();
}

async function main() {
  // Load workbook and sheet
  const workbook = XLSX.readFile('public/MMCC_Siblings_Data_Brief.xlsx');
  const sheet = workbook.Sheets['2. Families'];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`Loaded ${rows.length} family rows from the Excel sheet.`);

  // Load existing students from DB
  const dbStudents = await prisma.student.findMany();
  console.log(`Fetched ${dbStudents.length} students from the database.`);

  const studentMap = new Map();
  dbStudents.forEach(s => {
    studentMap.set(cleanName(s.name), s);
  });

  let newStudentsCount = 0;
  let linkedStudentsCount = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const membersStr = String(row['Members'] || '').trim();
    if (!membersStr || membersStr.toLowerCase() === 'undefined') continue;

    // Split members by comma
    const group = membersStr.split(',').map(m => m.trim()).filter(Boolean);
    if (group.length === 0) continue;

    console.log(`Processing Excel Row ${idx + 1} (Family #${row['Family #'] || 'N/A'}): ${group.join(', ')}`);

    let familyId = null;
    let matchedDbStudents = [];
    let studentsToCreate = [];

    // Match each member to a DB record or mark for creation
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

    // Determine Family ID
    const existingFamilies = matchedDbStudents
      .map(s => s.family_id)
      .filter(id => id !== null);

    if (existingFamilies.length > 0) {
      familyId = existingFamilies[0];
    } else {
      // Create new family
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
      console.log(`  Created new family: "${parentName}" (ID: ${familyId})`);
    }

    // Link existing students to family
    for (const student of matchedDbStudents) {
      if (student.family_id !== familyId) {
        await prisma.student.update({
          where: { id: student.id },
          data: { family_id: familyId }
        });
        linkedStudentsCount++;
      }
    }

    // Create missing students
    const referenceCentreId = matchedDbStudents.length > 0
      ? matchedDbStudents[0].centre_id
      : (await prisma.centre.findFirst()).id;

    for (const name of studentsToCreate) {
      // Avoid duplicate creation if already created in database
      const cleanNewName = cleanName(name);
      const alreadyExists = await prisma.student.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } }
      });
      
      if (!alreadyExists) {
        await prisma.student.create({
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
      } else {
        if (alreadyExists.family_id !== familyId) {
          await prisma.student.update({
            where: { id: alreadyExists.id },
            data: { family_id: familyId }
          });
          linkedStudentsCount++;
        }
      }
    }
  }

  // Cleanup empty families
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

  console.log(`\nImport & Verification Summary:`);
  console.log(`Total new students created: ${newStudentsCount}`);
  console.log(`Total existing students linked/merged: ${linkedStudentsCount}`);
  console.log(`Total empty families cleaned up: ${deletedFamiliesCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
