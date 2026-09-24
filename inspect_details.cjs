const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAll() {
  const students = await prisma.student.findMany({
    include: {
      coach: { include: { user: true } },
      centre: true,
      family: true,
      enrollments: {
        include: {
          slot: {
            include: { coach: { include: { user: true } } }
          }
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  console.log(`Total students in DB: ${students.length}`);
  // Group students by lowercase name
  const nameMap = new Map();
  for (const s of students) {
    const key = s.name.trim().toLowerCase();
    if (!nameMap.has(key)) nameMap.set(key, []);
    nameMap.get(key).push(s);
  }

  // Look for any duplicates
  console.log('\n--- DUPLICATE NAMES IN DB ---');
  for (const [name, list] of nameMap.entries()) {
    if (list.length > 1) {
      console.log(`Name "${name}" has ${list.length} records:`);
      list.forEach(s => {
        console.log(`  ID: ${s.id}, Name: "${s.name}", Coach: ${s.coach?.user?.name}, Centre: ${s.centre.name}, Status: ${s.status}, DOB: ${s.dob}, Notes: ${s.notes}, Parent: ${s.parent_name || s.family?.primary_name}`);
      });
    }
  }

  // Special checks for Reyansh Agarwal, Alex, Milaan/Milann, Leyaan, Daniil Apostolov, etc.
  console.log('\n--- SPECIAL CASES CHECK ---');
  const specialNames = ['reyansh', 'apostolov', 'alex', 'vergara', 'mikhail', 'sholi', 'cherif', 'daniil', 'vadim', 'wail', 'diansh', 'marah', 'asher', 'ananya', 'minha'];
  for (const sn of specialNames) {
    const matched = students.filter(s => s.name.toLowerCase().includes(sn));
    console.log(`\nMatches for "${sn}":`);
    matched.forEach(s => {
      console.log(`  ID: ${s.id} | Name: "${s.name}" | Coach: ${s.coach?.user?.name} | Centre: ${s.centre.name} | Status: ${s.status} | DOB: ${s.dob} | Parent: ${s.parent_name || s.family?.primary_name} | Notes: ${s.notes}`);
    });
  }
}

checkAll().catch(console.error).finally(() => prisma.$disconnect());
