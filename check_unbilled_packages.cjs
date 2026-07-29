const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    select: {
      name: true,
      flags: true,
      packages: {
        select: {
          id: true,
          classes_total: true
        }
      }
    }
  });

  const list = students.filter(s => s.flags && s.flags.unpaid_classes > 0);
  console.log(`Total overdue students: ${list.length}`);
  
  let zeroPackagesCount = 0;
  list.forEach(s => {
    if (s.packages.length === 0) {
      zeroPackagesCount++;
      console.log(`  No packages: ${s.name} (unpaid_classes: ${s.flags.unpaid_classes}, unpaid_value: ${s.flags.unpaid_value})`);
    }
  });
  console.log(`Overdue students with 0 packages: ${zeroPackagesCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
