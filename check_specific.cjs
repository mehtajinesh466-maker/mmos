const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const queries = [
  "aarya", "garge", "currimboy", "naser", "elija", "hridit", "kairav", "latiskh", "leyaan", "milann", "rhagav", "riyansh", "saad", "shuarya", "suleiman", "ayaan", "ananya puranic", "ananya puranik"
];

async function check() {
  const students = await prisma.student.findMany({
    include: { coach: { include: { user: true } }, centre: true }
  });

  for (const q of queries) {
    const found = students.filter(s => s.name.toLowerCase().includes(q) || (s.notes && s.notes.toLowerCase().includes(q)));
    console.log(`Query "${q}": found ${found.length} students:`);
    found.forEach(s => {
      console.log(`  - "${s.name}" (ID: ${s.id}, Coach: ${s.coach?.user?.name}, Centre: ${s.centre.name}, Notes: ${s.notes})`);
    });
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
