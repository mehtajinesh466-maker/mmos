const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const coaches = await prisma.coach.findMany({
    include: { user: true }
  });
  console.log("Coaches in DB:");
  coaches.forEach(c => {
    console.log(`- ${c.user?.name} (ID: ${c.id}, user_id: ${c.user_id})`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
