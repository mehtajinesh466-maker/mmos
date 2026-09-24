const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectAndEnroll() {
  const coaches = await prisma.coach.findMany({ include: { user: true } });
  const brett = coaches.find(c => c.user?.name.toLowerCase().includes('brett'));
  console.log(`Brett Coach ID: ${brett?.id}, Name: ${brett?.user?.name}`);

  const students = await prisma.student.findMany({
    where: {
      name: {
        contains: 'Raghav',
        mode: 'insensitive'
      }
    },
    include: {
      coach: { include: { user: true } },
      centre: true,
      enrollments: {
        include: {
          slot: true
        }
      }
    }
  });

  console.log(`\nFound ${students.length} students matching "Raghav":`);
  students.forEach(s => {
    console.log(`- ID: ${s.id} | Name: "${s.name}" | Coach: ${s.coach?.user?.name} | Centre: ${s.centre?.name}`);
    console.log(`  Existing Enrollments: ${s.enrollments.length}`);
    s.enrollments.forEach(e => {
      console.log(`    * Slot ID: ${e.slot.id} | Day: ${e.slot.day} | Time: ${e.slot.time} | Coach ID: ${e.slot.coach_id}`);
    });
  });

  // Find Brett's slots on Friday and Sunday
  const slots = await prisma.scheduleSlot.findMany({
    where: {
      coach_id: brett.id
    },
    include: {
      centre: true,
      enrollments: {
        include: {
          student: true
        }
      }
    }
  });

  console.log(`\nBrett's Schedule Slots (${slots.length}):`);
  slots.forEach(s => {
    console.log(`- Slot ID: ${s.id} | Day: "${s.day}" | Time: "${s.time}" | Level: "${s.level}" | Centre: "${s.centre?.name}" | Enrolled: ${s.enrollments.length} students`);
  });
}

inspectAndEnroll().catch(console.error).finally(() => prisma.$disconnect());
