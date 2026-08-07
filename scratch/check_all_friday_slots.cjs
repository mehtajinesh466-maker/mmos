const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const slots = await prisma.scheduleSlot.findMany({
    where: { day: 'Fri' },
    include: {
      coach: { include: { user: true } }
    }
  });

  console.log("All Friday slots in database:");
  for (const slot of slots) {
    const enrollments = await prisma.enrollment.findMany({
      where: { slot_id: slot.id }
    });
    const fallbackStudents = await prisma.student.findMany({
      where: {
        centre_id: slot.centre_id,
        level: slot.level,
        status: 'active'
      }
    });
    console.log(`Coach: ${slot.coach.user.name}, Time: ${slot.time}, Level: ${slot.level}`);
    console.log(`  - Enrollments: ${enrollments.length}, Fallback: ${fallbackStudents.length}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
