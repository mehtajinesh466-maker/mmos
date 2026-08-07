const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.student.findFirst({
    where: { name: { contains: 'Shreyans Garg' } },
    include: { packages: true }
  });

  if (!student) {
    console.log('Student Shreyans Garg not found.');
    return;
  }

  console.log(`Found student: ${student.name} (${student.id})`);
  
  const activePkgs = student.packages.filter(p => p.classes_remaining > 0);
  console.log(`Active packages count: ${activePkgs.length}`);

  for (const pkg of activePkgs) {
    console.log(`Updating package ${pkg.id}: remaining classes from ${pkg.classes_remaining} to 0`);
    await prisma.package.update({
      where: { id: pkg.id },
      data: { classes_remaining: 0 }
    });
  }

  console.log('Correction complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
