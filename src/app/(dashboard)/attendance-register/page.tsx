"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AttendanceRegister } from "../../../components/AttendanceRegister";
import { useCentre } from "../../../context/CentreContext";

export default function AttendanceRegisterPage() {
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
  
  return <AttendanceRegister currentUser={currentUser} activeCentre={activeCentre} />;
}
