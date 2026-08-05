const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const m = await prisma.student.findFirst({
    where: { name: { contains: 'Senguen', mode: 'insensitive' } },
    include: { family: true }
  });
  console.log("Mihail Senguen:", m);
  if (m && m.family_id) {
    const members = await prisma.student.findMany({
      where: { family_id: m.family_id }
    });
    console.log("Family members:", members.map(s => s.name));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
