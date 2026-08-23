"use client";

import React, { useState, useEffect } from 'react';
import { getActivePendingDeletions, undoDeletion, dismissPendingDeletion, syncDatabaseToClient } from '../app/actions';
import { db } from '../lib/db';

export function DeleteWarningBanner() {
  const [activeDeletions, setActiveDeletions] = useState<any[]>([]);

  useEffect(() => {
    // Check immediately, then poll every 4 seconds
    const checkDeletions = async () => {
      try {
        const deletions = await getActivePendingDeletions();
        setActiveDeletions(deletions || []);
      } catch (err) {
        console.warn("Failed to fetch active pending deletions:", err);
      }
    };

    checkDeletions();
    const interval = setInterval(checkDeletions, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleUndo = async (id: string) => {
    try {
      await undoDeletion(id);
      // Remove from local UI immediately
      setActiveDeletions(prev => prev.filter(d => d.id !== id));
      
      // Pull fresh data and sync local PWA database
      const freshData = await syncDatabaseToClient();
      db.syncFromNeon(freshData);
      
      alert("✓ Deletion undone successfully! Records restored.");
    } catch (err: any) {
      alert(`Failed to undo deletion: ${err.message}`);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismissPendingDeletion(id);
      setActiveDeletions(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.warn("Failed to dismiss deletion:", err);
    }
  };

  if (activeDeletions.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-xl px-4 pointer-events-none">
      {activeDeletions.map((del) => {
        // Calculate remaining seconds out of 20 seconds total
        const elapsedMs = Date.now() - new Date(del.deletedAt).getTime();
        const remainingSec = Math.max(0, Math.round((20000 - elapsedMs) / 1000));
        
        if (remainingSec <= 0) return null;

        return (
          <div
            key={del.id}
            className="pointer-events-auto bg-slate-900 border-l-4 border-red-500 text-white rounded-lg shadow-2xl p-4 flex items-center justify-between gap-4 animate-pulse backdrop-blur-md bg-opacity-95"
            style={{
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-red-200">
                  {del.deletedBy} deleted {del.entityType} "{del.entityName}"
                </p>
                <p className="text-xs text-slate-300">
                  Undo option expires in {remainingSec}s...
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleUndo(del.id)}
                className="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-medium text-xs px-3 py-1.5 rounded transition duration-150 cursor-pointer shadow-md"
              >
                Undo Deletion
              </button>
              <button
                onClick={() => handleDismiss(del.id)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-slate-800 transition duration-150 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
