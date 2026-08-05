"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface CentreContextType {
  activeCentre: string;
  setActiveCentre: (centreId: string) => void;
}

const CentreContext = createContext<CentreContextType | undefined>(undefined);

export const CentreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, status } = useSession();
  const [activeCentre, setActiveCentre] = useState<string>("All");

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    const user = session.user as any;
    if (user.role !== "owner" && user.centre_id) {
      setActiveCentre(user.centre_id);
    } else if (user.role === "owner") {
      setActiveCentre("All");
    }
  }, [status, session]);

  return (
    <CentreContext.Provider value={{ activeCentre, setActiveCentre }}>
      {children}
    </CentreContext.Provider>
  );
};

export const useCentre = () => {
  const context = useContext(CentreContext);
  if (!context) {
    throw new Error("useCentre must be used within a CentreProvider");
  }
  return context;
};
