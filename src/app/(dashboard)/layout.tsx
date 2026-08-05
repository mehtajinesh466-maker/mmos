"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Sidebar } from "../../components/Sidebar";
import { db } from "../../lib/db";
import { syncDatabaseToClient } from "../actions";
import { useCentre } from "../../context/CentreContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const { activeCentre, setActiveCentre } = useCentre();
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;

    // Render immediately using local cached data
    setIsReady(true);

    // Sync data from neon in background
    syncDatabaseToClient()
      .then((data) => {
        db.syncFromNeon(data);
      })
      .catch((e) => {
        console.error("Failed to sync DB in background", e);
      });

    const updateOfflineCount = () => {
      setOfflineCount(db.getOfflineQueue().length);
    };

    updateOfflineCount();
    window.addEventListener("offline-queue-changed", updateOfflineCount);

    const handleOnline = () => {
      db.syncOfflineQueue();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline-queue-changed", updateOfflineCount);
      window.removeEventListener("online", handleOnline);
    };
  }, [status, session]);

  const handleSyncQueue = () => {
    if (db.isOnline()) {
      db.syncOfflineQueue();
    } else {
      alert("You are currently offline. System will sync automatically when connection returns.");
    }
  };

  if (status === "loading" || !isReady || !session?.user) {
    return null;
  }

  const currentUser = session.user as any;

  return (
    <div className="grid grid-cols-[240px_1fr] h-screen w-screen overflow-hidden bg-canvas">
      <Sidebar
        activeCentre={activeCentre}
        setActiveCentre={setActiveCentre}
        currentUser={currentUser}
        offlineCount={offlineCount}
        onSync={handleSyncQueue}
      />
      <main className="h-screen overflow-y-auto bg-canvas flex flex-col relative">{children}</main>
    </div>
  );
}
