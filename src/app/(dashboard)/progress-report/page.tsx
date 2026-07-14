"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, Suspense } from "react";
import { ProgressReport } from "../../../components/ProgressReport";

export default function ProgressReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router, session]);

  if (status === "loading" || !session) return null;

  const currentUser = session.user as any;
  const activeCentre = currentUser.centre_id || "All";

  return (
    <Suspense fallback={<div className="p-10 text-center text-muted-custom">Loading Progress Report...</div>}>
      <ProgressReport currentUser={currentUser} activeCentre={activeCentre} />
    </Suspense>
  );
}
