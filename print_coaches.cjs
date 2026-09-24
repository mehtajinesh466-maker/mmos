const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const coaches = await prisma.coach.findMany({
    include: { user: true, centre: true }
  });
  console.log('ALL COACHES IN DB:');
  coaches.forEach(c => {
    console.log(`ID: ${c.id} | User: ${c.user?.name} | Email: ${c.user?.email} | Centre: ${c.centre?.name}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
