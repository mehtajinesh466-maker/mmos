"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Explorer } from "../../../components/Explorer";

export default function ExplorerPage() {
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

  return <Explorer />;
}
