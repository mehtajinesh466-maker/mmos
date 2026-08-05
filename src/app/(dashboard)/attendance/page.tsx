"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Attendance } from "../../../components/Attendance";
import { useCentre } from "../../../context/CentreContext";
import { db } from "../../../lib/db";

export default function AttendancePage() {
  const { data: session, status } = useSession();
  const { activeCentre } = useCentre();
  const router = useRouter();
  const [offlineCount, setOfflineCount] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading" || !session) return null;

  const currentUser = session.user as any;
  
  return (
    <Attendance
      currentUser={currentUser}
      activeCentre={activeCentre}
      onQueueChange={() => setOfflineCount(db.getOfflineQueue().length)}
    />
  );
}
