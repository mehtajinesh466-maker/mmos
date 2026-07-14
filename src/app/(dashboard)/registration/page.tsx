"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Registration } from "../../../components/Registration";

export default function RegistrationPage() {
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

  return <Registration currentUser={currentUser} activeCentre={activeCentre} />;
}
