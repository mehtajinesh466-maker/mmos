import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function getDayNumber(day: string): number {
  const map: Record<string, number> = {
    'sunday': 0, 'sun': 0,
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2,
    'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6
  };
  return map[day.toLowerCase()] ?? 1;
}

async function main() {
  const coach = await prisma.coach.findFirst({
    where: { user: { name: { contains: 'James', mode: 'insensitive' } } }
  });
  if (!coach) return console.log("Coach James not found");

  const slots = await prisma.scheduleSlot.findMany({
    where: { coach_id: coach.id },
    include: { enrollments: true }
  });
  
  const slotIds = slots.map(s => s.id);
  
  // Wipe all current class sessions for James to start fresh
  await prisma.classSession.deleteMany({
    where: { slot_id: { in: slotIds } }
  });
  console.log(`Deleted all existing class sessions for James.`);

  // Generate 12 weeks of sessions starting from this week
  const today = new Date();
  
  const payload = [];

  for (const slot of slots) {
    if (slot.enrollments.length === 0) continue;
    
    const dayNum = getDayNumber(slot.day);
    
    // Find the Monday of the current week
    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const mondayThisWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + distanceToMonday);
    
    // Find the date for this slot's day in the current week
    const firstDate = new Date(mondayThisWeek);
    const offset = dayNum === 0 ? 6 : dayNum - 1; // days since Monday
    firstDate.setDate(firstDate.getDate() + offset);
    
    // Create 12 sessions
    for (const enr of slot.enrollments) {
      for (let i = 0; i < 12; i++) {
        const targetDate = new Date(firstDate);
        targetDate.setDate(targetDate.getDate() + (i * 7));
        
        // Use local noon, but wait: Prisma saves this to a db.Date. 
        // If we use noon local time, when converted to UTC it stays on the same day.
        // e.g. 12:00 IST = 06:30 UTC. Postgres casts this to Date => 2026-09-07.
        // Then Prisma reads it as 2026-09-07T00:00:00Z.
        // So the DB stores exactly the right day!
        targetDate.setHours(12, 0, 0, 0); 

        payload.push({
          student_id: enr.student_id,
          slot_id: slot.id,
          scheduled_date: targetDate,
          status: 'scheduled'
        });
      }
    }
  }
  
  if (payload.length > 0) {
    await prisma.classSession.createMany({
      data: payload
    });
  }
  
  console.log(`Successfully generated ${payload.length} perfect ClassSessions for James.`);
}

main().finally(() => prisma.$disconnect());
