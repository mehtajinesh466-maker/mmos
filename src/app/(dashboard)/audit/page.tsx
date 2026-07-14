"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuditLogView } from "../../../components/AuditLogView";

export default function AuditPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (session?.user?.role !== "owner") {
      router.push("/");
    }
  }, [status, router, session]);

  if (status === "loading" || !session) return null;

  const currentUser = session.user as any;

  return <AuditLogView currentUser={currentUser} />;
}
