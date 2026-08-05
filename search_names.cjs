const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dbStudents = await prisma.student.findMany({
    select: { name: true }
  });
  console.log("Nyra:", dbStudents.filter(s => s.name.toLowerCase().includes("nyra")));
  console.log("Dam:", dbStudents.filter(s => s.name.toLowerCase().includes("dam")));
  console.log("Vihaan:", dbStudents.filter(s => s.name.toLowerCase().includes("vihaan")));
  console.log("Visha:", dbStudents.filter(s => s.name.toLowerCase().includes("visha") || s.name.toLowerCase().includes("garg")));
  console.log("Joshua:", dbStudents.filter(s => s.name.toLowerCase().includes("joshua") || s.name.toLowerCase().includes("lemke")));
  console.log("Aanya / Anya:", dbStudents.filter(s => s.name.toLowerCase().includes("aanya") || s.name.toLowerCase().includes("anya") || s.name.toLowerCase().includes("jain")));
  console.log("Saxena:", dbStudents.filter(s => s.name.toLowerCase().includes("saxena")));
  console.log("Gupta:", dbStudents.filter(s => s.name.toLowerCase().includes("gupta")));
  console.log("Draidi:", dbStudents.filter(s => s.name.toLowerCase().includes("draidi")));
  console.log("Raipancholia:", dbStudents.filter(s => s.name.toLowerCase().includes("raipancholia")));
  console.log("Jhunjhunwala:", dbStudents.filter(s => s.name.toLowerCase().includes("jhunjhunwala")));
  console.log("Yousef:", dbStudents.filter(s => s.name.toLowerCase().includes("yousef")));
  console.log("Saraf:", dbStudents.filter(s => s.name.toLowerCase().includes("saraf")));
}

main().catch(console.error).finally(() => prisma.$disconnect());
