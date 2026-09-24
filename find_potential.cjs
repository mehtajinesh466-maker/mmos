const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findPotentialMatches() {
  const students = await prisma.student.findMany({
    include: { coach: { include: { user: true } }, centre: true }
  });

  const checkList = [
    "Aarya", "Aaryan Garge", "Aiden Currimboy", "Aya Naser", "Bhavisha Arwani",
    "Borozdin Mikhail", "Elija", "Hridit", "Kairav", "Kanav Bansal", "Latiksh", "Latiskh",
    "Leyaan", "Leyaan vergara", "Milann vergara", "Milaan vergara", "Rhagav", "Riyansh Agarwal",
    "Saad", "Shuarya Shah", "Suleiman", "Vince Peralta", "Yohan Peralta", "Yuvaan"
  ];

  for (const item of checkList) {
    const parts = item.toLowerCase().split(' ').filter(Boolean);
    const matches = students.filter(s => {
      const sName = s.name.toLowerCase();
      return parts.some(p => sName.includes(p));
    });
    console.log(`\nSearched "${item}": found ${matches.length} candidates:`);
    matches.forEach(m => {
      console.log(`  - "${m.name}" (ID: ${m.id}, Coach: ${m.coach?.user?.name || 'Unassigned'}, Centre: ${m.centre.name})`);
    });
  }
}

findPotentialMatches().catch(console.error).finally(() => prisma.$disconnect());
