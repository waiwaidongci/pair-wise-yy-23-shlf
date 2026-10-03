import { useEffect } from "react";
import { useSyncStore } from "../stores/SyncStore";

// 监听浏览器联网/断网事件，同步到 store
export function useOnlineStatus(): boolean {
  const online = useSyncStore((s) => s.online);
  const setOnline = useSyncStore((s) => s.setOnline);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [setOnline]);

  return online;
}
