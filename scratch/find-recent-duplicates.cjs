const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Let's get all attendance logs created today (since 2026-08-05) or in general look for duplicate (student_id, date, slot_id)
  const allAttendance = await prisma.attendance.findMany({
    orderBy: { created_at: 'desc' }
  });

  const groups = {};
  for (const att of allAttendance) {
    const dateStr = new Date(att.date).toISOString().split('T')[0];
    const key = `${att.student_id}_${dateStr}_${att.slot_id}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(att);
  }

  const duplicates = Object.values(groups).filter(g => g.length > 1);

  console.log(`Found ${duplicates.length} groups of duplicate attendance logs:`);
  for (const group of duplicates) {
    const first = group[0];
    const student = await prisma.student.findUnique({ where: { id: first.student_id } });
    console.log(`\nStudent: ${student ? student.name : first.student_id}`);
    console.log(`Slot ID: ${first.slot_id} | Date: ${new Date(first.date).toISOString().split('T')[0]}`);
    console.log(`Number of records: ${group.length}`);
    group.forEach(r => {
      console.log(`  - Record ID: ${r.id} | Status: ${r.status} | Created At: ${r.created_at}`);
    });

    // Check packages for this student
    const pkgs = await prisma.package.findMany({
      where: { student_id: first.student_id }
    });
    console.log(`Student's packages:`);
    pkgs.forEach(p => {
      console.log(`  - Package ID: ${p.id} | Size: ${p.classes_total} | Remaining: ${p.classes_remaining} | Frozen: ${p.frozen}`);
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error);
