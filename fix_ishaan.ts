import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function getDayNumber(day: string): number {
  const map: Record<string, number> = {
    'sunday': 0, 'sun': 0, 'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2, 'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4, 'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6
  };
  return map[day.toLowerCase()] ?? 1;
}

async function main() {
  const coach = await prisma.coach.findFirst({
    where: { user: { name: { contains: 'Reggie', mode: 'insensitive' } } }
  });
  if (!coach) return console.log("Reggie not found");

  const krishaan = await prisma.student.findFirst({
    where: { name: { contains: 'KRISHAAN', mode: 'insensitive' } }
  });

  // Create or find Ishaan Mahtani
  let ishaan = await prisma.student.findFirst({
    where: { name: { equals: 'Ishaan Mahtani', mode: 'insensitive' } }
  });

  if (!ishaan) {
    ishaan = await prisma.student.create({
      data: {
        name: 'Ishaan Mahtani',
        centre_id: coach.centre_id,
        coach_id: coach.id,
        level: 'Junior - Elite'
      }
    });
    console.log("Created missing student: Ishaan Mahtani");
  } else {
    // Update his level to Junior - Elite just in case
    await prisma.student.update({
      where: { id: ishaan.id },
      data: { level: 'Junior - Elite' }
    });
  }

  // Find the slots that Ishaan is supposed to be in
  // WED 6-7 PM, FRI 6-7 PM, SAT 4-6 PM (which is 16:00 - 17:00 and 17:00 - 18:00)
  const slotConditions = [
    { day: 'Wed', time: '18:00 - 19:00' },
    { day: 'Fri', time: '18:00 - 19:00' },
    { day: 'Sat', time: '16:00 - 17:00' },
    { day: 'Sat', time: '17:00 - 18:00' }
  ];

  const slotsToSwap = await prisma.scheduleSlot.findMany({
    where: {
      coach_id: coach.id,
      OR: slotConditions
    }
  });

  let swappedSessionsCount = 0;
  const today = new Date();

  for (const slot of slotsToSwap) {
    if (krishaan) {
      // Unenroll Krishaan from this slot
      const krishEnr = await prisma.enrollment.findFirst({
        where: { student_id: krishaan.id, slot_id: slot.id }
      });
      if (krishEnr) {
        await prisma.enrollment.delete({ where: { id: krishEnr.id } });
        // Delete Krishaan's class sessions in this slot
        await prisma.classSession.deleteMany({
          where: { student_id: krishaan.id, slot_id: slot.id }
        });
        console.log(`Removed Krishaan from ${slot.day} ${slot.time}`);
      }
    }

    // Enroll Ishaan in this slot
    const existingIshaanEnr = await prisma.enrollment.findFirst({
      where: { student_id: ishaan.id, slot_id: slot.id }
    });

    if (!existingIshaanEnr) {
      await prisma.enrollment.create({
        data: { student_id: ishaan.id, slot_id: slot.id }
      });
      console.log(`Enrolled Ishaan in ${slot.day} ${slot.time}`);
      
      // Generate perfect class sessions for Ishaan
      const dayNum = getDayNumber(slot.day);
      const currentDay = today.getDay();
      const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const mondayThisWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + distanceToMonday);
      const firstDate = new Date(mondayThisWeek);
      const offset = dayNum === 0 ? 6 : dayNum - 1; 
      firstDate.setDate(firstDate.getDate() + offset);

      const sessionPayload = [];
      for (let i = 0; i < 12; i++) {
        const targetDate = new Date(firstDate);
        targetDate.setDate(targetDate.getDate() + (i * 7));
        targetDate.setHours(12, 0, 0, 0); 
        sessionPayload.push({
          student_id: ishaan.id,
          slot_id: slot.id,
          scheduled_date: targetDate,
          status: 'scheduled'
        });
      }
      
      await prisma.classSession.createMany({ data: sessionPayload });
      swappedSessionsCount += sessionPayload.length;
    }
  }

  console.log(`Successfully fixed Ishaan Mahtani (Generated ${swappedSessionsCount} perfect ClassSessions).`);
}

main().finally(() => prisma.$disconnect());
