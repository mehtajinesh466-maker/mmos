const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const nyra = await prisma.student.findFirst({
    where: { name: { contains: 'Nyra', mode: 'insensitive' } },
    include: { family: true }
  });
  console.log("Nyra's family & details:", nyra);
  
  if (nyra && nyra.family_id) {
    const familyMembers = await prisma.student.findMany({
      where: { family_id: nyra.family_id }
    });
    console.log("Nyra's family members:", familyMembers.map(s => s.name));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
