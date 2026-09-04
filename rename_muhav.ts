import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const nuhav = await prisma.student.findFirst({
    where: { name: 'Nuhav' }
  });

  if (nuhav) {
    await prisma.student.update({
      where: { id: nuhav.id },
      data: { name: 'Muhav' }
    });
    console.log("Renamed 'Nuhav' to 'Muhav' in the database. All schedules and enrollments are preserved.");
  } else {
    console.log("Could not find 'Nuhav' to rename.");
  }
}

main().finally(() => prisma.$disconnect());
