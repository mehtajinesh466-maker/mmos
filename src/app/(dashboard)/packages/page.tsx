"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, Suspense } from "react";
import { Packages } from "../../../components/Packages";

export default function PackagesPage() {
  const { data: session, status } = useSession();
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
  const activeCentre = currentUser.centre_id || "All";

  return (
    <Suspense fallback={<div className="p-10 text-center text-muted-custom">Loading Package Form...</div>}>
      <Packages currentUser={currentUser} activeCentre={activeCentre} />
    </Suspense>
  );
}
