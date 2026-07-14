"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Students } from "../../../components/Students";

export default function StudentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading" || !session) return null;

  const currentUser = session.user as any;
  const activeCentre = currentUser.centre_id || "All";

  return <Students currentUser={currentUser} activeCentre={activeCentre} />;
}
