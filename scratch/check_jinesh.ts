import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const student = await prisma.student.findFirst({
    where: { name: 'Jinesh Kumar Mehta' },
    include: { packages: true, invoices: true }
  });
  console.log(JSON.stringify(student, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
