const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const targetNames = [
    'Aadwitya Chawla',
    'Aarav Srivastav', // Abu Dhabi
    'Advay Sureka',
    'Ahaan jain',
    'Haneesh Patnaikuni',
    'Ilyes Gherras',
    'Misha Garg',
    'Pavika Grover'
  ];

  const students = await prisma.student.findMany({
    where: {
      OR: targetNames.map(n => ({ name: { contains: n, mode: 'insensitive' } }))
    },
    include: {
      attendance: {
        orderBy: { date: 'desc' }
      }
    }
  });

  const today = new Date("2026-08-23T18:39:12+05:30"); // User's local time context

  console.log(`Anchor Date (today): ${today.toISOString()} (${today.getTime()})`);
  console.log(`========================================`);

  students.forEach(s => {
    console.log(`Student: "${s.name}" (${s.id})`);
    console.log(`  Attendance Records:`);
    s.attendance.forEach(a => {
      const dateObj = new Date(a.date);
      const diffMs = today.getTime() - dateObj.getTime();
      const diffDays = Math.floor(diffMs / 86400000);
      console.log(`    Date: ${a.date.toISOString().split('T')[0]} | Status: ${a.status} | Duration: ${a.duration} | DiffDays: ${diffDays}`);
    });
    console.log(`----------------------------------------`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
