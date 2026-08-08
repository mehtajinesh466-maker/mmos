import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const packages = await prisma.package.findMany({
    include: { invoices: true, tier: true }
  });
  console.log(`Checking ${packages.length} packages...`);
  let createdCount = 0;
  for (const pkg of packages) {
    if (pkg.invoices.length === 0) {
      const amount = pkg.tier ? Number(pkg.tier.price) : 1200;
      await prisma.invoice.create({
        data: {
          student_id: pkg.student_id,
          package_id: pkg.id,
          amount: amount,
          status: 'unpaid',
          created_at: pkg.start_date || new Date()
        }
      });
      console.log(`Created unpaid invoice for student ${pkg.student_id}, package ${pkg.id}, amount ${amount}`);
      createdCount++;
    }
  }
  console.log(`Backfill finished. Created ${createdCount} invoices.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
