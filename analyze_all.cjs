const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeAll() {
  const students = await prisma.student.findMany({
    include: {
      coach: { include: { user: true } },
      centre: true,
      family: true
    },
    orderBy: { name: 'asc' }
  });

  const coaches = await prisma.coach.findMany({
    include: { user: true }
  });

  const bret = coaches.find(c => c.user.name.toLowerCase().includes('brett'));
  const bryle = coaches.find(c => c.user.name.toLowerCase().includes('brylle'));
  const ryan = coaches.find(c => c.user.name.toLowerCase().includes('ryan'));

  console.log(`Bret ID: ${bret?.id} (${bret?.user.name})`);
  console.log(`Bryle ID: ${bryle?.id} (${bryle?.user.name})`);
  console.log(`Ryan ID: ${ryan?.id} (${ryan?.user.name})`);

  // Let's print all students with their current coach and centre
  console.log(`Total students: ${students.length}`);
}

analyzeAll().catch(console.error).finally(() => prisma.$disconnect());
