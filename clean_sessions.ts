import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const coach = await prisma.coach.findFirst({
    where: { user: { name: { contains: 'James', mode: 'insensitive' } } }
  });
  if (!coach) return;
  
  const slots = await prisma.scheduleSlot.findMany({ where: { coach_id: coach.id } });
  const slotIds = slots.map(s => s.id);
  
  const sessions = await prisma.classSession.findMany({
    where: { slot_id: { in: slotIds } }
  });
  
  const keepIds = new Set<string>();
  const deleteIds = new Set<string>();
  
  const seen = new Set<string>();
  
  for (const s of sessions) {
    // Normalize date to YYYY-MM-DD
    const dateStr = s.scheduled_date.toISOString().split('T')[0];
    const key = `${s.student_id}|${s.slot_id}|${dateStr}`;
    if (seen.has(key)) {
      deleteIds.add(s.id);
    } else {
      seen.add(key);
      keepIds.add(s.id);
    }
  }
  
  if (deleteIds.size > 0) {
    await prisma.classSession.deleteMany({
      where: { id: { in: Array.from(deleteIds) } }
    });
    console.log(`Deleted ${deleteIds.size} duplicate class sessions.`);
  } else {
    console.log("No duplicate class sessions found.");
  }
}
main().finally(() => prisma.$disconnect());
