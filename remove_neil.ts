import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.student.findFirst({
    where: { name: { contains: 'Neil Dhakan', mode: 'insensitive' } },
    include: {
      enrollments: {
        include: { slot: true }
      }
    }
  });

  if (!student) return console.log("Neil Dhakan not found");

  const enrollment = student.enrollments.find(e => e.slot.time === '17:00 - 18:00');
  
  if (enrollment) {
    await prisma.enrollment.delete({
      where: { id: enrollment.id }
    });
    console.log(`Deleted Neil Dhakan's enrollment in ${enrollment.slot.day} 17:00 - 18:00 slot.`);
    
    const deletedSessions = await prisma.classSession.deleteMany({
      where: {
        student_id: student.id,
        slot_id: enrollment.slot.id
      }
    });
    console.log(`Deleted ${deletedSessions.count} ClassSessions for Neil Dhakan.`);
  } else {
    console.log("Neil Dhakan is not enrolled in any 17:00 - 18:00 slot.");
  }
}

main().finally(() => prisma.$disconnect());
