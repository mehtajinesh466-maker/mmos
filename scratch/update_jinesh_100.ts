import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const result = await prisma.invoice.updateMany({
    where: {
      student: {
        name: 'Jinesh Kumar Mehta'
      }
    },
    data: {
      amount: 100
    }
  });
  console.log(`Successfully updated ${result.count} invoice amounts to 100.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
