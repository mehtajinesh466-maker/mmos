import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    orderBy: { name: 'asc' }
  });
  
  const nameCounts = new Map<string, number>();
  for (const s of students) {
    const n = s.name.toLowerCase().trim();
    nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
  }
  
  for (const [name, count] of nameCounts.entries()) {
    if (count > 1) {
      console.log(`DUPLICATE STUDENT: ${name} (${count} times)`);
    }
  }
}
main().finally(() => prisma.$disconnect());
