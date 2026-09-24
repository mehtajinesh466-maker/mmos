const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function searchAnanya() {
  const students = await prisma.student.findMany({
    where: {
      name: {
        contains: 'Ananya',
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
      },
      attendance: {
        take: 5,
        orderBy: { date: 'desc' },
        include: {
          coach: {
            include: {
              user: true
            }
          }
        }
      }
    }
  });

  console.log(`Found ${students.length} students matching "Ananya":\n`);
  for (const s of students) {
    console.log(`=============================================`);
    console.log(`Student ID: ${s.id}`);
    console.log(`Name: ${s.name}`);
    console.log(`Status: ${s.status}`);
    console.log(`Centre: ${s.centre?.name} (ID: ${s.centre_id})`);
    console.log(`Assigned Coach ID: ${s.coach_id}`);
    console.log(`Assigned Coach Name: ${s.coach?.user?.name || 'None'}`);
    console.log(`Assigned Coach Email: ${s.coach?.user?.email || 'None'}`);
    console.log(`Assigned Coach Title: ${s.coach?.title || 'None'}`);
    console.log(`Enrollments (${s.enrollments.length}):`);
    s.enrollments.forEach(e => {
      console.log(`  - Slot: ${e.slot.day} ${e.slot.time} | Level: ${e.slot.level} | Slot Coach: ${e.slot.coach?.user?.name}`);
    });
    console.log(`Recent Attendance (${s.attendance.length}):`);
    s.attendance.forEach(a => {
      console.log(`  - Date: ${a.date.toISOString().split('T')[0]} | Status: ${a.status} | Coach: ${a.coach?.user?.name}`);
    });
    console.log(`=============================================\n`);
  }
}

searchAnanya().catch(console.error).finally(() => prisma.$disconnect());
