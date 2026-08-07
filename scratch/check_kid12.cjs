const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.student.findFirst({
    where: { name: { contains: 'Kid 12' } },
    include: {
      packages: true,
      attendance: true
    }
  });

  if (!student) {
    console.log("Student not found");
    return;
  }

  console.log("Student name:", student.name);
  console.log("Packages:", student.packages.map(p => ({
    id: p.id,
    classes_total: p.classes_total,
    classes_remaining: p.classes_remaining,
    start_date: p.start_date
  })));
  console.log("Attendance details:", student.attendance.map(a => ({
    date: a.date,
    status: a.status,
    duration: a.duration,
    created_at: a.created_at
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
