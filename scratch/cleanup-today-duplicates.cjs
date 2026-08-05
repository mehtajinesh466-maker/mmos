const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Analyzing attendance logs created since Aug 1, 2026...");

  const startDate = new Date("2026-08-01T00:00:00.000Z");

  // Fetch attendance records
  const records = await prisma.attendance.findMany({
    where: {
      created_at: {
        gte: startDate
      }
    },
    orderBy: {
      created_at: 'asc'
    }
  });

  console.log(`Found ${records.length} records created since Aug 1, 2026.`);
  for (const r of records) {
    const student = await prisma.student.findUnique({ where: { id: r.student_id } });
    console.log(`  - Record ID: ${r.id} | Student: ${student ? student.name : r.student_id} | Date: ${new Date(r.date).toISOString().split('T')[0]} | Created At: ${r.created_at}`);
  }

  const groups = {};
  for (const r of records) {
    const dateStr = new Date(r.date).toISOString().split('T')[0];
    const key = `${r.student_id}_${dateStr}_${r.slot_id}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  let cleanedCount = 0;
  let refundedClasses = 0;

  for (const [key, list] of Object.entries(groups)) {
    if (list.length <= 1) continue;

    const original = list[0];
    const duplicates = list.slice(1);

    const student = await prisma.student.findUnique({ where: { id: original.student_id } });
    console.log(`\n[DUPLICATE GROUP] Student: ${student ? student.name : original.student_id}`);
    console.log(`Date: ${new Date(original.date).toISOString().split('T')[0]} | Slot: ${original.slot_id}`);
    console.log(`Original Record ID: ${original.id} (Status: ${original.status})`);
    console.log(`Duplicates to remove: ${duplicates.length}`);

    for (const dup of duplicates) {
      if (dup.status === 'present') {
        const duration = dup.duration || 2;
        
        const pkgs = await prisma.package.findMany({
          where: { student_id: dup.student_id, frozen: false },
          orderBy: { start_date: 'asc' }
        });
        
        let pkgToRestore = pkgs.find(p => p.classes_remaining < p.classes_total);
        
        if (!pkgToRestore && student && student.family_id) {
          const siblings = await prisma.student.findMany({
            where: { family_id: student.family_id }
          });
          const siblingIds = siblings.map(s => s.id);
          const sharedPkgs = await prisma.package.findMany({
            where: { student_id: { in: siblingIds }, is_family_shared: true, frozen: false },
            orderBy: { start_date: 'asc' }
          });
          pkgToRestore = sharedPkgs.find(p => p.classes_remaining < p.classes_total);
        }

        if (pkgToRestore) {
          const newRemaining = pkgToRestore.classes_remaining + duration;
          await prisma.package.update({
            where: { id: pkgToRestore.id },
            data: { classes_remaining: newRemaining }
          });
          console.log(`  -> Refunded ${duration} classes to package ${pkgToRestore.id} (new balance: ${newRemaining}/${pkgToRestore.classes_total})`);
          refundedClasses += duration;
        } else {
          console.log(`  -> WARNING: No package found to restore classes to!`);
        }
      }

      await prisma.attendance.delete({
        where: { id: dup.id }
      });
      cleanedCount++;
    }
  }

  console.log(`\nCleanup completed successfully!`);
  console.log(`Removed ${cleanedCount} duplicate attendance records.`);
  console.log(`Refunded ${refundedClasses} total classes.`);

  await prisma.$disconnect();
}

main().catch(console.error);
