import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const result = await prisma.invoice.updateMany({
    where: {
      student: {
        name: {
          in: ['test-new', 'Jinesh Kumar Mehta']
        }
      }
    },
    data: {
      amount: 1200
    }
  });
  console.log(`Successfully updated ${result.count} invoice amounts to 1200.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
