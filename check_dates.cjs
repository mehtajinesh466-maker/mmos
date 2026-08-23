const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const attendance = await prisma.attendance.findMany({
    select: { date: true }
  });

  if (attendance.length === 0) {
    console.log("No attendance records found!");
    return;
  }

  let minDate = attendance[0].date;
  let maxDate = attendance[0].date;
  const yearCounts = {};

  attendance.forEach(a => {
    if (a.date < minDate) minDate = a.date;
    if (a.date > maxDate) maxDate = a.date;
    const year = a.date.getFullYear();
    yearCounts[year] = (yearCounts[year] || 0) + 1;
  });

  console.log('--- DATABASE ATTENDANCE DATE RANGE ---');
  console.log('Min Date:', minDate.toISOString().split('T')[0]);
  console.log('Max Date:', maxDate.toISOString().split('T')[0]);
  console.log('Year Distribution:', yearCounts);
}

main().catch(console.error).finally(() => prisma.$disconnect());
