"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CoachRegister } from "../../../components/CoachRegister";
import { useCentre } from "../../../context/CentreContext";

export default function CoachRegisterPage() {
  const { data: session, status } = useSession();
  const { activeCentre } = useCentre();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading" || !session) return null;

  const currentUser = session.user as any;
  
  return <CoachRegister currentUser={currentUser} activeCentre={activeCentre} />;
}
