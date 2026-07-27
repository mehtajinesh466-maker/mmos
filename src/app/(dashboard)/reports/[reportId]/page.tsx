"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";
import { ReportViewer } from "../../../../components/ReportViewer";

export default function ReportDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();

  const reportId = params.reportId as string;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (session?.user?.role !== "owner" && session?.user?.role !== "front_desk") {
      router.push("/");
    } else if (session?.user?.role === "front_desk") {
      const restrictedReports = [
        'revenue-summary',
        'unbilled-leak',
        'data-reconciliation',
        'collection-list',
        'membership-economics',
        'lifetime-value',
        'rate-card',
        'revenue-contribution',
        'centre-perf',
        'growth-trajectory',
        'new-centre-model',
        'board-investor-pack'
      ];
      if (restrictedReports.includes(reportId)) {
        router.push("/reports-centre");
      }
    }
  }, [status, router, session, reportId]);

  if (status === "loading" || !session) return null;

  return <ReportViewer reportId={reportId} />;
}
