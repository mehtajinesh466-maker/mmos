import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.student.findFirst({
    where: { name: { contains: 'Veer Bajaj', mode: 'insensitive' } },
    include: { classSessions: { include: { slot: true } } }
  });
  
  if (!student) return console.log('not found');
  
  console.log(`Student: ${student.name} (${student.id})`);
  console.log(`ClassSessions: ${student.classSessions.length}`);
  
  for (const cs of student.classSessions) {
    console.log(`- CS ID: ${cs.id} | Slot: ${cs.slot.day} ${cs.slot.time} | Date: ${cs.scheduled_date} | Status: ${cs.status}`);
  }
}
main().finally(() => prisma.$disconnect());
