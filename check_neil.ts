import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.student.findFirst({
    where: { name: { contains: 'Neil Dhakan', mode: 'insensitive' } },
    include: {
      enrollments: {
        include: { slot: true }
      },
      classSessions: {
        include: { slot: true }
      }
    }
  });

  if (!student) return console.log("Neil Dhakan not found");

  console.log(`Student found: ${student.name}`);
  console.log("Enrollments:");
  for (const enr of student.enrollments) {
    console.log(`- Slot ID: ${enr.slot.id}, Day: ${enr.slot.day}, Time: ${enr.slot.time}`);
  }
}

main().finally(() => prisma.$disconnect());
