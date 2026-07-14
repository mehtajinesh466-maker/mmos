"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ActionCentre } from "../../../components/ActionCentre";

export default function ActionCentrePage() {
  const { data: session, status } = useSession();
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
  const activeCentre = currentUser.centre_id || "All";

  return <ActionCentre currentUser={currentUser} activeCentre={activeCentre} />;
}
