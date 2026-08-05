"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CRM } from "../../../components/CRM";
import { useCentre } from "../../../context/CentreContext";

export default function CRMPage() {
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
  
  return <CRM currentUser={currentUser} activeCentre={activeCentre} />;
}
