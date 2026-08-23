const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.student.findFirst({
    where: { name: 'Aryaveer Sundaram' },
    include: { attendance: { orderBy: { date: 'desc' } } }
  });

  if (!student) {
    console.log("Aryaveer Sundaram not found in database!");
    return;
  }

  console.log(`Student: "${student.name}" (${student.id})`);
  console.log(`Total Attendance Records in DB: ${student.attendance.length}`);
  console.log(`Latest 10 Attendance records:`);
  student.attendance.slice(0, 10).forEach(a => {
    console.log(`  Date = ${a.date.toISOString().split('T')[0]}, Status = ${a.status}, Duration = ${a.duration}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
