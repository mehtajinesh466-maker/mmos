const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    where: {
      name: { contains: 'Vihaan', mode: 'insensitive' }
    },
    include: { family: true }
  });
  console.log("Vihaans:");
  for (const s of students) {
    console.log(s.name, "Parent:", s.parent_name, "Family Phone:", s.family?.phone, "Family Primary:", s.family?.primary_name);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
