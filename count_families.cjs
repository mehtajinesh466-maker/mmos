const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const familyCount = await prisma.family.count();
  console.log(`TOTAL_FAMILIES:${familyCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
