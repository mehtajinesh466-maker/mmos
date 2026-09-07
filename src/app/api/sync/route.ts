import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [
      centres,
      users,
      coachesRaw,
      families,
      students,
      tiers,
      packages,
      scheduleSlots,
      attendanceRaw,
      invoices,
      enquiries,
      enrollments,
      progressLogsRaw,
      notifications,
      tournamentReports,
      classSessions
    ] = await Promise.all([
      prisma.centre.findMany(),
      prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, centre_id: true } }),
      prisma.coach.findMany({ include: { user: true } }),
      prisma.family.findMany(),
      prisma.student.findMany(),
      prisma.tier.findMany(),
      prisma.package.findMany(),
      prisma.scheduleSlot.findMany(),
      prisma.attendance.findMany({
        select: {
          id: true,
          student_id: true,
          slot_id: true,
          coach_id: true,
          date: true,
          status: true,
          topic: true,
          note: true,
          duration: true,
          created_at: true
        }
      }),
      prisma.invoice.findMany(),
      prisma.enquiry.findMany(),
      prisma.enrollment.findMany(),
      prisma.progressLog.findMany(),
      prisma.notification.findMany(),
      prisma.tournamentReport.findMany(),
      prisma.classSession.findMany()
    ]);

    const coaches = coachesRaw.map(c => ({
      ...c,
      name: c.user?.name || 'Unassigned',
    }));

    const attendance = attendanceRaw.map(a => ({
      ...a,
      date: a.date ? a.date.toISOString().split('T')[0] : '',
      created_at: a.created_at ? a.created_at.toISOString() : ''
    }));

    return NextResponse.json({
      success: true,
      centres,
      users,
      coaches,
      families,
      students,
      tiers,
      packages,
      scheduleSlots,
      attendance,
      invoices,
      enquiries,
      enrollments,
      progressLogs: progressLogsRaw,
      notifications,
      tournamentReports,
      classSessions
    });
  } catch (error: any) {
    console.error('Error in /api/sync:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
