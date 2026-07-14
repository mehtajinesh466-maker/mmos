"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Attendance } from "../../../components/Attendance";
import { db } from "../../../lib/db";

export default function AttendancePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [offlineCount, setOfflineCount] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (session?.user?.role === "front_desk") {
      // Front desk shouldn't access attendance typically, but if allowed, adjust here.
      // Default deny for front_desk to attendance for now
      router.push("/");
    }
  }, [status, router, session]);

  if (status === "loading" || !session) return null;

  const currentUser = session.user as any;
  const activeCentre = currentUser.centre_id || "All";

  return (
    <Attendance
      currentUser={currentUser}
      activeCentre={activeCentre}
      onQueueChange={() => setOfflineCount(db.getOfflineQueue().length)}
    />
  );
}
