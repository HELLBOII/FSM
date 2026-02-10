import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { syncManager } from './SyncManager';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({ syncing: false, progress: 0 });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = syncManager.onSyncStatusChange(setSyncStatus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  if (isOnline && !syncStatus.syncing) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50">
      <Badge 
        variant={isOnline ? "default" : "secondary"}
        className={cn(
          "px-3 py-1.5 shadow-lg",
          isOnline 
            ? "bg-emerald-500 hover:bg-emerald-600" 
            : "bg-orange-500 text-white hover:bg-orange-600"
        )}
      >
        {syncStatus.syncing ? (
          <>
            <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
            Syncing... {syncStatus.progress}%
          </>
        ) : isOnline ? (
          <>
            <Wifi className="w-3 h-3 mr-1.5" />
            Online
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3 mr-1.5" />
            Offline Mode
          </>
        )}
      </Badge>
    </div>
  );
}