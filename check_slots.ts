import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const coach = await prisma.coach.findFirst({
    where: { user: { name: { contains: 'James', mode: 'insensitive' } } },
    include: { user: true }
  });
  
  if (!coach) return console.log('No coach found');
  
  const slots = await prisma.scheduleSlot.findMany({
    where: { coach_id: coach.id },
    include: { _count: { select: { enrollments: true } } },
    orderBy: [{ day: 'asc' }, { time: 'asc' }]
  });
  
  console.log(`Coach ${coach.user?.name} has ${slots.length} slots`);
  for (const slot of slots) {
    console.log(`${slot.day} | ${slot.time} | Enrollments: ${slot._count.enrollments} | ID: ${slot.id}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
