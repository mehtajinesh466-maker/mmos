import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { runSeed } from '../../../lib/seedAction';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== 'owner') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await runSeed();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Seed API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

