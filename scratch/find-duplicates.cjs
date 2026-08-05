const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find all attendance records group by student, slot, date
  const records = await prisma.attendance.findMany({
    orderBy: { created_at: 'desc' }
  });

  const seen = new Set();
  const duplicates = [];

  for (const r of records) {
    const dateStr = new Date(r.date).toISOString().split('T')[0];
    const key = `${r.student_id}-${r.slot_id}-${dateStr}`;
    if (seen.has(key)) {
      duplicates.push(r);
    } else {
      seen.add(key);
    }
  }

  console.log('--- DUPLICATE ATTENDANCE RECORDS ---');
  console.log(JSON.stringify(duplicates.map(d => ({
    id: d.id,
    student_id: d.student_id,
    date: d.date,
    status: d.status,
    duration: d.duration,
    created_at: d.created_at
  })), null, 2));

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
