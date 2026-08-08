import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateStudentFlags(studentId: string) {
  const allPkgs = await prisma.package.findMany({
    where: { student_id: studentId, frozen: false }
  });
  const totalRemaining = allPkgs.reduce((sum, p) => sum + p.classes_remaining, 0);

  const attendedSum = await prisma.attendance.aggregate({
    _sum: { duration: true },
    where: {
      student_id: studentId,
      status: { in: ['present', 'makeup'] }
    }
  });
  const totalAttended = attendedSum._sum.duration || 0;

  const totalPurchased = allPkgs.reduce((sum, p) => sum + p.classes_total, 0);
  const unpaidClasses = Math.max(0, totalAttended - totalPurchased);

  let studentRate = 125;
  if (allPkgs.length > 0) {
    const sorted = [...allPkgs].sort((a, b) => new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime());
    const latestPkg = sorted[0];
    const invoice = await prisma.invoice.findFirst({ where: { package_id: latestPkg.id } });
    if (invoice && invoice.amount) {
      studentRate = Math.round(Number(invoice.amount) / latestPkg.classes_total);
    } else if (latestPkg.tier_id) {
      const tier = await prisma.tier.findUnique({ where: { id: latestPkg.tier_id } });
      if (tier && tier.price) {
        const discount = latestPkg.discount_pct ? Number(latestPkg.discount_pct) : 0;
        studentRate = Math.round(Number(tier.price) * (1 - discount / 100) / latestPkg.classes_total);
      }
    }
  }
  const unpaidValue = unpaidClasses * studentRate;

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (student) {
    const flags = typeof student.flags === 'object' && student.flags ? { ...(student.flags as any) } : {};
    if (totalRemaining <= 2) {
      flags.low_package = true;
    } else {
      delete flags.low_package;
    }

    if (unpaidClasses > 0) {
      flags.unpaid_classes = unpaidClasses;
      flags.unpaid_value = unpaidValue;
    } else {
      delete flags.unpaid_classes;
      delete flags.unpaid_value;
    }

    const latestAttendance = await prisma.attendance.findFirst({
      where: { student_id: studentId, status: { in: ['present', 'makeup'] } },
      orderBy: { date: 'desc' }
    });

    await prisma.student.update({
      where: { id: studentId },
      data: {
        flags,
        last_attended: latestAttendance ? latestAttendance.date : null
      }
    });
    console.log(`Successfully updated flags for student: ${student.name}. Remaining: ${totalRemaining}, Unpaid classes: ${unpaidClasses}`);
  }
}

async function run() {
  const chloe = await prisma.student.findFirst({
    where: { name: 'Chloe Miller' }
  });
  if (chloe) {
    await updateStudentFlags(chloe.id);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
