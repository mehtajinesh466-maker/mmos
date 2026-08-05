const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    where: {
      name: {
        contains: 'dummy',
        mode: 'insensitive'
      }
    }
  });

  console.log(`Found ${students.length} dummy students.`);

  for (const student of students) {
    console.log(`\n========================================`);
    console.log(`STUDENT: ${student.name} (${student.id})`);
    
    // Get packages
    const pkgs = await prisma.package.findMany({
      where: { student_id: student.id }
    });
    console.log(`Packages:`);
    pkgs.forEach(p => {
      console.log(`  - ID: ${p.id} | Kind: ${p.kind} | Total: ${p.classes_total} | Remaining: ${p.classes_remaining} | Frozen: ${p.frozen}`);
    });

    // Get attendance
    const atts = await prisma.attendance.findMany({
      where: { student_id: student.id },
      orderBy: { date: 'asc' }
    });
    console.log(`Attendance Records:`);
    atts.forEach(a => {
      console.log(`  - ID: ${a.id} | Date: ${new Date(a.date).toISOString().split('T')[0]} | Status: ${a.status} | Duration: ${a.duration} | Created At: ${a.created_at}`);
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error);
