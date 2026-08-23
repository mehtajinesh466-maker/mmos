const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    where: { name: { contains: 'Pavika', mode: 'insensitive' } },
    include: {
      centre: true,
      attendance: { orderBy: { date: 'desc' }, take: 10 }
    }
  });

  console.log(`Found ${students.length} students matching "Pavika":`);
  students.forEach((s, idx) => {
    console.log(`Student #${idx + 1}: "${s.name}" (${s.id})`);
    console.log(`  Centre: ${s.centre.name}`);
    console.log(`  Total Attendance Records in DB for this student: ${s.attendance.length}`);
    console.log(`  Latest 5 Attendance dates for this student:`);
    s.attendance.slice(0, 5).forEach(a => {
      console.log(`    Date: ${a.date.toISOString().split('T')[0]} | Duration: ${a.duration}`);
    });
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
