const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const coaches = await prisma.coach.findMany({
    include: { user: true }
  });
  console.log('COACHES IN DB:');
  console.log(coaches.map(c => ({ id: c.id, name: c.user?.name, email: c.user?.email, title: c.title })));

  const students = await prisma.student.findMany({
    include: {
      coach: {
        include: { user: true }
      },
      centre: true
    },
    orderBy: { name: 'asc' }
  });
  console.log(`\nTOTAL STUDENTS IN DB: ${students.length}`);
  console.log('\nSTUDENTS:');
  students.forEach(s => {
    console.log(`- ${s.name} | Coach: ${s.coach?.user?.name || 'Unassigned'} (CoachID: ${s.coach_id}) | Centre: ${s.centre?.name} | Status: ${s.status}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
