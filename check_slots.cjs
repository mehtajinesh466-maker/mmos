const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const slots = await prisma.scheduleSlot.findMany();
  console.log("SCHEDULE SLOTS:", slots.map(s => ({ id: s.id, time: s.time, level: s.level })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
