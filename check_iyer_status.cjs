const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    where: {
      name: { contains: 'Iyer', mode: 'insensitive' }
    }
  });
  
  for (const s of students) {
    console.log("Student:", s.name);
    console.log("  Status:", s.status);
    console.log("  Centre ID:", s.centre_id);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
