const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const coach = await prisma.coach.findFirst({
    where: {
      user: {
        name: { contains: 'James', mode: 'insensitive' }
      }
    },
    include: {
      user: true
    }
  });
  if (!coach) {
    console.log("Coach James not found");
    return;
  }
  console.log(`Coach name: ${coach.user.name} (${coach.id})`);

  // Find schedule slots
  const slots = await prisma.scheduleSlot.findMany({
    where: { coach_id: coach.id, day: 'Fri' }
  });

  console.log("Slots on Friday:");
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

    console.log(`Slot ID: ${slot.id}, Time: ${slot.time}, Level: ${slot.level}, Centre: ${slot.centre_id}`);
    console.log(`  - Enrollments count: ${enrollments.length}`);
    console.log(`  - Fallback students count: ${fallbackStudents.length}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
