import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const atts = await prisma.attendance.findMany({
      select: {
        id: true,
        student_id: true,
        coach_id: true,
        slot_id: true,
        date: true,
        status: true
      }
    });

    const data = atts.map(a => ({
      id: a.id,
      student_id: a.student_id,
      coach_id: a.coach_id,
      slot_id: a.slot_id,
      date: a.date ? a.date.toISOString().split('T')[0] : '',
      status: a.status
    }));

    return NextResponse.json({ success: true, data, count: data.length });
  } catch (error: any) {
    console.error('Error fetching attendance chart data:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
