const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const jinesh = await prisma.student.findFirst({
    where: { name: { contains: 'Jinesh Kumar Mehta', mode: 'insensitive' } }
  });
  if (!jinesh) {
    console.log("Jinesh not found!");
    return;
  }
  console.log("JINESH STUDENT:", { id: jinesh.id, name: jinesh.name });
  const atts = await prisma.attendance.findMany({
    where: { student_id: jinesh.id }
  });
  console.log("ATTENDANCE RECORDS:", atts.map(a => ({
    id: a.id,
    date: a.date,
    status: a.status,
    duration: a.duration,
    slot_id: a.slot_id
  })));
  if (atts.length > 0) {
    const slotIds = [...new Set(atts.map(a => a.slot_id).filter(Boolean))];
    const slots = await prisma.scheduleSlot.findMany({
      where: { id: { in: slotIds } }
    });
    console.log("SLOTS DETAILS:", slots.map(s => ({
      id: s.id,
      time: s.time,
      day: s.day,
      level: s.level
    })));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
