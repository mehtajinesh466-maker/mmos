"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Analytics } from "../../../components/Analytics";
import { useCentre } from "../../../context/CentreContext";

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const { activeCentre } = useCentre();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (session?.user?.role !== "owner" && session?.user?.role !== "front_desk") {
      router.push("/");
    }
  }, [status, router, session]);

  if (status === "loading" || !session) return null;

  const currentUser = session.user as any;
  
  return <Analytics activeCentre={activeCentre} currentUser={currentUser} />;
}
