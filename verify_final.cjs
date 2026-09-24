const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyAll() {
  const coaches = await prisma.coach.findMany({ include: { user: true } });
  const bret = coaches.find(c => c.user?.name.toLowerCase().includes('brett'));
  const bryle = coaches.find(c => c.user?.name.toLowerCase().includes('brylle'));
  const ryan = coaches.find(c => c.user?.name.toLowerCase().includes('ryan'));

  const students = await prisma.student.findMany({
    include: {
      coach: { include: { user: true } },
      centre: true
    },
    orderBy: { name: 'asc' }
  });

  console.log(`\n================ CURRENT COACH ASSIGNMENT STATUS ================`);
  const coachCounts = {};
  for (const s of students) {
    const cName = s.coach?.user?.name || 'Unassigned';
    coachCounts[cName] = (coachCounts[cName] || 0) + 1;
  }
  console.log('Coach Student Distribution:');
  console.table(coachCounts);

  // Check specific test cases from user PDF:
  const checkList = [
    { name: "Aadya", expected: "Ryan" },
    { name: "Adam Draidi", expected: "Brett" },
    { name: "Marah Draidi", expected: "Brett" },
    { name: "Ananya Puranik", expected: "Brylle" },
    { name: "Asher", expected: "Brett" },
    { name: "Diansh", expected: "Ryan" },
    { name: "DIANSH JOSHI", expected: "Ryan" },
    { name: "Vadim Apostolov", expected: "Brylle" },
    { name: "Daniil Apostolov", expected: "Brylle" },
    { name: "Minha Harith", expected: "Brett" },
    { name: "Shaurya Gurehiya", expected: "Brett" },
    { name: "Reeva Dhanani", expected: "Ryan" },
    { name: "Reyansh Agarwal", expected: "Brylle" },
    { name: "Reyansh Agarwal Private", expected: "Brett" },
    { name: "Milann Vergura", expected: "Brylle" },
    { name: "Milaan Vergara-", expected: "Brett" },
    { name: "Kiyaan Veer Chopra", expected: "Ryan" },
    { name: "Kanav Bansal", expected: "Brett" }
  ];

  console.log('\n--- VERIFICATION SPOT CHECKS ---');
  for (const item of checkList) {
    const s = students.find(st => st.name.toLowerCase().includes(item.name.toLowerCase()));
    if (s) {
      const actualCoach = s.coach?.user?.name || 'Unassigned';
      const ok = actualCoach.toLowerCase().includes(item.expected.toLowerCase());
      console.log(`[${ok ? 'PASS' : 'FAIL'}] "${s.name}" -> ${actualCoach} (Expected: Coach ${item.expected})`);
    } else {
      console.log(`[MISSING] Could not find student "${item.name}" in DB`);
    }
  }
}

verifyAll().catch(console.error).finally(() => prisma.$disconnect());
