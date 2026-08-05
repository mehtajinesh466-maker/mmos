"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Schedule } from "../../../components/Schedule";
import { useCentre } from "../../../context/CentreContext";

export default function SchedulePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { activeCentre } = useCentre();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading" || !session) return null;

  const currentUser = session.user as any;

  return <Schedule currentUser={currentUser} activeCentre={activeCentre} />;
}
