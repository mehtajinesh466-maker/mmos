"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ReportsCentre } from "../../../components/ReportsCentre";

export default function ReportsCentrePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (session?.user?.role !== "owner" && session?.user?.role !== "front_desk") {
      router.push("/");
    }
  }, [status, router, session]);

  if (status === "loading" || !session) return null;

  return <ReportsCentre currentUser={session.user} />;
}
