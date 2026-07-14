"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";
import { ReportViewer } from "../../../../components/ReportViewer";

export default function ReportDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (session?.user?.role !== "owner") {
      router.push("/");
    }
  }, [status, router, session]);

  if (status === "loading" || !session) return null;

  const reportId = params.reportId as string;

  return <ReportViewer reportId={reportId} />;
}
