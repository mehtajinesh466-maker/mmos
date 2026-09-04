import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const coach = await prisma.coach.findFirst({
    where: { user: { name: { contains: 'James', mode: 'insensitive' } } }
  });
  if (!coach) return;
  
  const slot = await prisma.scheduleSlot.findFirst({
    where: {
      coach_id: coach.id,
      day: 'Mon',
      time: '12:00 - 13:00'
    },
    include: {
      enrollments: {
        include: { student: true }
      },
      classSessions: {
        include: { student: true }
      }
    }
  });
  
  if (!slot) {
    console.log("Slot not found.");
    return;
  }
  
  console.log(`Slot: ${slot.day} ${slot.time}`);
  console.log("Enrollments:");
  for (const enr of slot.enrollments) {
    console.log(`- ${enr.student.name} (Enrolled at: ${enr.enrolled_at})`);
  }
  
  console.log("\nClass Sessions:");
  for (const cs of slot.classSessions) {
    const dateStr = cs.scheduled_date.toISOString().split('T')[0];
    console.log(`- ${cs.student.name} on ${dateStr} [Status: ${cs.status}]`);
  }
}
main().finally(() => prisma.$disconnect());
