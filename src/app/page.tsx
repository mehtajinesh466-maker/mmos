"use client";

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RootPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && session?.user) {
      const role = (session.user as any).role;
      const savedRole = localStorage.getItem("mmos_active_role") || role;
      
      if (savedRole === 'owner') {
        router.push('/analytics');
      } else if (savedRole === 'front_desk') {
        router.push('/action-centre');
      } else if (savedRole === 'coach') {
        router.push('/schedule');
      } else if (savedRole === 'parent') {
        router.push('/student-dashboard');
      }
    }
  }, [status, session, router]);

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      Loading Dashboard...
    </div>
  );
}
