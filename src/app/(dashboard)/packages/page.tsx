"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, Suspense } from "react";
import { Packages } from "../../../components/Packages";
import { useCentre } from "../../../context/CentreContext";

export default function PackagesPage() {
  const { data: session, status } = useSession();
  const { activeCentre } = useCentre();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (session?.user?.role === "coach") {
      router.push("/");
    }
  }, [status, router, session]);

  if (status === "loading" || !session) return null;

  const currentUser = session.user as any;
  
  return (
    <Suspense fallback={<div className="p-10 text-center text-muted-custom">Loading Package Form...</div>}>
      <Packages currentUser={currentUser} activeCentre={activeCentre} />
    </Suspense>
  );
}
