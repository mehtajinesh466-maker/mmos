import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Delete bogus student 'Muhav'
  const muhav = await prisma.student.findFirst({
    where: { name: 'Muhav' }
  });

  if (muhav) {
    await prisma.classSession.deleteMany({ where: { student_id: muhav.id } });
    await prisma.enrollment.deleteMany({ where: { student_id: muhav.id } });
    await prisma.student.delete({ where: { id: muhav.id } });
    console.log("Deleted bogus student 'Muhav'.");
  }

  // 2. Find real student 'Nuhav'
  const nuhav = await prisma.student.findFirst({
    where: { name: 'Nuhav' },
    include: { enrollments: { include: { slot: true } } }
  });

  if (!nuhav) return console.log("Nuhav not found.");

  // Delete his buggy class sessions
  const deleted = await prisma.classSession.deleteMany({
    where: { student_id: nuhav.id }
  });
  console.log(`Deleted ${deleted.count} buggy class sessions for Nuhav.`);

  // 3. Generate perfect class sessions for Nuhav for his current enrollments
  let createdCount = 0;
  const today = new Date();
  
  for (const enr of nuhav.enrollments) {
    const slot = enr.slot;
    const dayMap: Record<string, number> = {
      'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
    };
    const dayNum = dayMap[slot.day.toLowerCase()] ?? 1;
    
    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const mondayThisWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + distanceToMonday);
    
    const firstDate = new Date(mondayThisWeek);
    const offset = dayNum === 0 ? 6 : dayNum - 1; 
    firstDate.setDate(firstDate.getDate() + offset);
    
    const payload = [];
    for (let i = 0; i < 12; i++) {
      const targetDate = new Date(firstDate);
      targetDate.setDate(targetDate.getDate() + (i * 7));
      targetDate.setHours(12, 0, 0, 0); 

      payload.push({
        student_id: nuhav.id,
        slot_id: slot.id,
        scheduled_date: targetDate,
        status: 'scheduled'
      });
    }
    
    await prisma.classSession.createMany({ data: payload });
    createdCount += payload.length;
  }
  
  console.log(`Generated ${createdCount} perfect ClassSessions for Nuhav.`);
}

main().finally(() => prisma.$disconnect());
