const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const activeCount = await prisma.student.count({
    where: { status: 'active' }
  });
  const inactiveCount = await prisma.student.count({
    where: { status: 'inactive' }
  });
  const leftCount = await prisma.student.count({
    where: { status: 'left' }
  });
  const frozenCount = await prisma.student.count({
    where: { status: 'frozen' }
  });
  
  console.log('Active students:', activeCount);
  console.log('Inactive students:', inactiveCount);
  console.log('Left students:', leftCount);
  console.log('Frozen students:', frozenCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
