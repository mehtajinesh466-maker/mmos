"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PackageRegister } from "../../../components/PackageRegister";
import { useCentre } from "../../../context/CentreContext";

export default function PackageRegisterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { activeCentre } = useCentre();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (session?.user?.role === "coach") {
      router.push("/");
    }
  }, [status, router, session]);

  if (status === "loading" || !session) return null;

  const currentUser = session.user as any;

  return <PackageRegister currentUser={currentUser} activeCentre={activeCentre} />;
}
