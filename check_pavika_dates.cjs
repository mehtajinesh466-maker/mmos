const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.student.findFirst({
    where: { name: { contains: 'Pavika Grover', mode: 'insensitive' } },
    include: { attendance: { orderBy: { date: 'desc' } } }
  });

  if (!student) {
    console.log("Pavika Grover not found!");
    return;
  }

  const today = new Date("2026-08-23T18:39:12+05:30"); // System local time
  console.log(`Pavika Grover Attendance Dates (relative to today ${today.toISOString()}):`);

  student.attendance.forEach(a => {
    const diffMs = today.getTime() - new Date(a.date).getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    console.log(`  Date: ${a.date.toISOString().split('T')[0]} | Status: ${a.status} | Duration: ${a.duration} | DiffDays: ${diffDays}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
