const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Analyzing duplicate attendance records (ignoring slot_id) since Aug 1, 2026...");

  const startDate = new Date("2026-08-01T00:00:00.000Z");

  const records = await prisma.attendance.findMany({
    where: {
      created_at: {
        gte: startDate
      }
    },
    orderBy: {
      created_at: 'asc' // oldest first
    }
  });

  console.log(`Found ${records.length} total attendance records created since Aug 1.`);

  // Group by student_id and dateStr (YYYY-MM-DD)
  const groups = {};
  for (const r of records) {
    const dateStr = new Date(r.date).toISOString().split('T')[0];
    const key = `${r.student_id}_${dateStr}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  let cleanedCount = 0;
  let refundedClasses = 0;

  for (const [key, list] of Object.entries(groups)) {
    if (list.length <= 1) continue;

    // We have duplicates! Let's keep the first record (original) and process the rest as duplicates.
    const original = list[0];
    const duplicates = list.slice(1);

    const student = await prisma.student.findUnique({ where: { id: original.student_id } });
    console.log(`\n[DUPLICATE DETECTED] Student: ${student ? student.name : original.student_id}`);
    console.log(`Date: ${new Date(original.date).toISOString().split('T')[0]}`);
    console.log(`Keeping original record: ${original.id} (Status: ${original.status}, Slot: ${original.slot_id})`);

    for (const dup of duplicates) {
      console.log(`Removing duplicate record: ${dup.id} (Status: ${dup.status}, Slot: ${dup.slot_id})`);

      // If the duplicate was marked present, refund the classes
      if (dup.status === 'present') {
        const duration = dup.duration || 2;

        const pkgs = await prisma.package.findMany({
          where: { student_id: dup.student_id, frozen: false },
          orderBy: { start_date: 'asc' }
        });

        // Find package with room to restore
        let pkgToRestore = pkgs.find(p => p.classes_remaining < p.classes_total);

        // Fallback for sibling packages
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
          console.log(`  -> WARNING: No package found with space to restore classes.`);
        }
      }

      // Delete the duplicate attendance record
      await prisma.attendance.delete({
        where: { id: dup.id }
      });
      cleanedCount++;
    }
  }

  console.log(`\nCleanup finished.`);
  console.log(`Deleted ${cleanedCount} duplicate records.`);
  console.log(`Refunded ${refundedClasses} classes.`);

  await prisma.$disconnect();
}

main().catch(console.error);
