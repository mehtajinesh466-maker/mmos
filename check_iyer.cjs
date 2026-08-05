const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    where: {
      name: { contains: 'Iyer', mode: 'insensitive' }
    },
    include: { family: true }
  });
  
  for (const s of students) {
    console.log("Student:", s.name);
    console.log("  ID:", s.id);
    console.log("  Family ID:", s.family_id);
    console.log("  Family Details:", s.family);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
