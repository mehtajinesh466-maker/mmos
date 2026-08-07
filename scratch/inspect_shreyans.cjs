const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.student.findFirst({
    where: { name: { contains: 'Shreyans Garg' } },
    include: {
      packages: true,
      attendance: {
        orderBy: { date: 'asc' }
      }
    }
  });

  if (!student) {
    console.log("Student not found");
    return;
  }

  console.log("Student name:", student.name);
  console.log("Flags:", student.flags);
  console.log("Packages:");
  student.packages.forEach(p => {
    console.log(`- ID: ${p.id}, Total: ${p.classes_total}, Remaining: ${p.classes_remaining}, Start: ${p.start_date}`);
  });
  console.log(`Attendance count: ${student.attendance.length}`);
  student.attendance.forEach(a => {
    console.log(`- Date: ${a.date.toISOString().split('T')[0]}, Status: ${a.status}, Duration: ${a.duration}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
