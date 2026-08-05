const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dbStudents = await prisma.student.findMany({
    select: { name: true }
  });
  console.log("Drai:", dbStudents.filter(s => s.name.toLowerCase().includes("drai")));
  console.log("Marah:", dbStudents.filter(s => s.name.toLowerCase().includes("marah") || s.name.toLowerCase().includes("mara")));
  console.log("Seng:", dbStudents.filter(s => s.name.toLowerCase().includes("seng") || s.name.toLowerCase().includes("seug")));
}

main().catch(console.error).finally(() => prisma.$disconnect());
