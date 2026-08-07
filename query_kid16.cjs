const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.student.findFirst({
    where: { name: { contains: 'ZZTEST Kid 16' } },
    include: {
      packages: true,
      attendance: true
    }
  });

  if (!student) {
    console.log('ZZTEST Kid 16 not found.');
    return;
  }

  console.log('STUDENT:', student.name, 'FLAGS:', student.flags);
  console.log('PACKAGES:');
  student.packages.forEach(p => {
    console.log(`  Package ID: ${p.id}, Total: ${p.classes_total}, Remaining: ${p.classes_remaining}, Kind: ${p.kind}, Frozen: ${p.frozen}`);
  });
  console.log('ATTENDANCE:');
  student.attendance.forEach(a => {
    console.log(`  Attendance Date: ${a.date}, Status: ${a.status}, Duration: ${a.duration}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
