import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const coach = await prisma.coach.findFirst({
    where: { user: { name: { contains: 'Reggie', mode: 'insensitive' } } }
  });
  if (!coach) return console.log("Reggie not found");

  const slot = await prisma.scheduleSlot.findFirst({
    where: { coach_id: coach.id, day: 'Sat', time: '16:00 - 17:00' },
    include: { enrollments: { include: { student: true } } }
  });

  if (!slot) return console.log("Slot not found");

  for (const enr of slot.enrollments) {
    console.log(`- ${enr.student.name} (${enr.student.level})`);
  }
}
main().finally(() => prisma.$disconnect());
