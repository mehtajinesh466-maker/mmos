import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    where: {
      OR: [
        { name: { contains: 'uhav', mode: 'insensitive' } }
      ]
    },
    include: {
      enrollments: { include: { slot: true } }
    }
  });

  for (const s of students) {
    console.log(`Student: ${s.name} (Level: ${s.level})`);
    for (const enr of s.enrollments) {
      console.log(`- Enrolled: ${enr.slot.day} ${enr.slot.time}`);
    }
  }
}
main().finally(() => prisma.$disconnect());
