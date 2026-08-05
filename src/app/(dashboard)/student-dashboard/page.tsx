"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, Suspense } from "react";
import { StudentDashboard } from "../../../components/StudentDashboard";
import { useCentre } from "../../../context/CentreContext";

export default function StudentDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { activeCentre } = useCentre();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router, session]);

  if (status === "loading" || !session) return null;

  const currentUser = session.user as any;

  return (
    <Suspense fallback={<div className="p-10 text-center text-muted-custom">Loading Dashboard...</div>}>
      <StudentDashboard currentUser={currentUser} activeCentre={activeCentre} />
    </Suspense>
  );
}
