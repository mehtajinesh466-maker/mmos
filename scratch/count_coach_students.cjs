const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const coach = await prisma.coach.findFirst({
    where: { user: { name: { contains: 'James', mode: 'insensitive' } } }
  });
  if (!coach) return;

  const count = await prisma.student.count({
    where: {
      coach_id: coach.id,
      centre_id: 'd51606ee-83b0-4150-aa0d-75b7649b062b', // Bay Avenue
      level: 'Beginner',
      status: 'active'
    }
  });

  console.log(`Active Beginner students in Bay Avenue assigned to James Estrada: ${count}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
