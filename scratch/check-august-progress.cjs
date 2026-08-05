const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Checking all progress logs recorded in August 2026...");

  const logs = await prisma.progressLog.findMany({
    where: {
      date: {
        gte: new Date("2026-08-01T00:00:00.000Z"),
        lte: new Date("2026-08-31T23:59:59.999Z")
      }
    },
    orderBy: {
      date: 'asc'
    }
  });

  console.log(`Found ${logs.length} logs in August 2026.`);
  for (const log of logs) {
    const student = await prisma.student.findUnique({ where: { id: log.student_id } });
    console.log(`- Date: ${new Date(log.date).toISOString().split('T')[0]} | Student: ${student ? student.name : log.student_id} | Topic: ${log.focus_area} | Evaluation: ${log.evaluation}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
