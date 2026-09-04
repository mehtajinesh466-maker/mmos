import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.student.findFirst({
    where: { name: { contains: 'Veer Bajaj', mode: 'insensitive' } },
    include: { enrollments: { include: { slot: true } } }
  });
  
  if (!student) return console.log('not found');
  
  console.log(`Student: ${student.name} (${student.id})`);
  console.log(`Enrollments: ${student.enrollments.length}`);
  
  for (const enr of student.enrollments) {
    console.log(`- Slot: ${enr.slot.day} ${enr.slot.time} (Slot ID: ${enr.slot.id}, Enr ID: ${enr.id})`);
  }
}
main().finally(() => prisma.$disconnect());
