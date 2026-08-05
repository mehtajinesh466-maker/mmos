const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Checking recent progress logs...");

  // Fetch the 10 most recently created progress logs
  const logs = await prisma.progressLog.findMany({
    orderBy: {
      id: 'desc'
    },
    take: 15
  });

  for (const log of logs) {
    const student = await prisma.student.findUnique({ where: { id: log.student_id } });
    console.log(`Log ID: ${log.id} | Student: ${student ? student.name : log.student_id} | Date in DB: ${log.date ? new Date(log.date).toISOString().split('T')[0] : 'null'} | Topic: ${log.focus_area}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
