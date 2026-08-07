const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const studentNames = [
    'Haneesh Patnaikuni',
    'Skand Nandiraju',
    'Shreyans Garg',
    'Aisha Agarwal',
    'Vihaan Dalvi',
    'Yohann Charles Peralta',
    'ZZTEST Kid 12'
  ];

  console.log("Checking coach assignment for students:");
  for (const name of studentNames) {
    const s = await prisma.student.findFirst({
      where: { name: { contains: name, mode: 'insensitive' } },
      include: { coach: { include: { user: true } } }
    });
    if (s) {
      console.log(`- Student: ${s.name}, Coach: ${s.coach?.user?.name || 'Unassigned'} (coach_id: ${s.coach_id})`);
    } else {
      console.log(`- Student: ${name} not found`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
