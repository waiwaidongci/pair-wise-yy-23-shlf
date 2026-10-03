import { useEffect } from "react";
import { useSyncStore } from "../stores/SyncStore";
import { subscribeConnectivity, isOnline } from "../utils/connectivity";

// Re-render on navigator online/offline and the demo's forced-offline toggle.
// Volunteers get an automatic retry when 恢复网络.
export function useOnlineSync(onReconnect?: () => Promise<void> | void) {
  const online = useSyncStore((state) => state.online);
  const setOnline = useSyncStore((state) => state.setOnline);

  useEffect(() => {
    const update = () => {
      const next = isOnline();
      setOnline(next);
      if (next) void onReconnect?.();
    };
    const unsubscribe = subscribeConnectivity(update);
    update();
    return unsubscribe;
  }, [setOnline, onReconnect]);

  return online;
}
