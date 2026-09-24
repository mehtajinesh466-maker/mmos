const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDetails() {
  const names = ['Ananya', 'Wail'];
  for (const name of names) {
    const students = await prisma.student.findMany({
      where: {
        name: {
          contains: name,
          mode: 'insensitive'
        }
      },
      include: {
        coach: {
          include: {
            user: true
          }
        },
        centre: true,
        family: true,
        enrollments: {
          include: {
            slot: {
              include: {
                coach: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log(`\n======================================================`);
    console.log(`RESULTS FOR "${name}" (Found ${students.length}):`);
    console.log(`======================================================`);
    for (const s of students) {
      console.log(`ID: ${s.id}`);
      console.log(`Name: "${s.name}"`);
      console.log(`Status: ${s.status}`);
      console.log(`Centre: ${s.centre?.name}`);
      console.log(`Coach ID: ${s.coach_id}`);
      console.log(`Coach Name: ${s.coach?.user?.name || 'Unassigned'}`);
      console.log(`Coach Email: ${s.coach?.user?.email || 'N/A'}`);
      console.log(`Enrollments: ${s.enrollments.length}`);
      s.enrollments.forEach(e => {
        console.log(`  -> Slot: ${e.slot.day} ${e.slot.time} | Level: ${e.slot.level} | Slot Coach: ${e.slot.coach?.user?.name}`);
      });
      console.log(`------------------------------------------------------`);
    }
  }
}

checkDetails().catch(console.error).finally(() => prisma.$disconnect());
