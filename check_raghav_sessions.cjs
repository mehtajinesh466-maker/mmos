const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRaghavSessions() {
  const raghav = await prisma.student.findUnique({
    where: { id: '87d1b67c-37d8-42a9-9ddf-c432d3d40519' },
    include: {
      enrollments: {
        include: {
          slot: {
            include: { coach: { include: { user: true } } }
          }
        }
      },
      classSessions: {
        orderBy: { scheduled_date: 'asc' },
        include: {
          slot: {
            include: { coach: { include: { user: true } } }
          }
        }
      }
    }
  });

  console.log(`Student: ${raghav.name} (ID: ${raghav.id})`);
  console.log(`Enrollments (${raghav.enrollments.length}):`);
  raghav.enrollments.forEach(e => {
    console.log(`  - Slot ID: ${e.slot.id} | Day: ${e.slot.day} | Time: ${e.slot.time} | Coach: ${e.slot.coach?.user?.name}`);
  });

  console.log(`\nClass Sessions (${raghav.classSessions.length}):`);
  raghav.classSessions.slice(0, 10).forEach(cs => {
    console.log(`  - Date: ${cs.scheduled_date.toISOString().split('T')[0]} | Status: ${cs.status} | Slot: ${cs.slot.day} ${cs.slot.time} (${cs.slot.coach?.user?.name})`);
  });
}

checkRaghavSessions().catch(console.error).finally(() => prisma.$disconnect());
