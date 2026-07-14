import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execPromise = promisify(exec);

export async function POST() {
  try {
    const seedScript = path.join(process.cwd(), 'prisma', 'seed.ts');
    await execPromise(`npx tsx "${seedScript}"`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Seed API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
