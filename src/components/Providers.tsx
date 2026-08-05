"use client";

import { SessionProvider } from "next-auth/react";
import React from "react";
import { CentreProvider } from "../context/CentreContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CentreProvider>{children}</CentreProvider>
    </SessionProvider>
  );
}
