"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, Suspense } from "react";
import { PackageReport } from "../../../components/PackageReport";
import { useCentre } from "../../../context/CentreContext";

export default function PackageReportPage() {
  const { data: session, status } = useSession();
  const { activeCentre } = useCentre();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router, session]);

  if (status === "loading" || !session) return null;

  const currentUser = session.user as any;
  
  return (
    <Suspense fallback={<div className="p-10 text-center text-muted-custom">Loading Package Report...</div>}>
      <PackageReport currentUser={currentUser} activeCentre={activeCentre} />
    </Suspense>
  );
}
