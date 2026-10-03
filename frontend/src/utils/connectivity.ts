// Offline detection used by the sync transport. In the field this is
// navigator.onLine + online/offline events; the demo also forces failures to
// exercise 同步失败后保留本机批次，恢复网络重试.
const OVERRIDE_KEY = "braille-trainer:force-offline";

// In-memory fallback keeps the forced-offline toggle working in non-DOM test
// environments; browsers use localStorage so a reload preserves the demo state.
let memoryOverride = false;

function readOverride(): boolean {
  if (typeof localStorage !== "undefined") return localStorage.getItem(OVERRIDE_KEY) === "1";
  return memoryOverride;
}

export function isOnline(): boolean {
  if (readOverride()) return false;
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

export function setForcedOffline(offline: boolean): void {
  if (typeof localStorage !== "undefined") {
    if (offline) localStorage.setItem(OVERRIDE_KEY, "1");
    else localStorage.removeItem(OVERRIDE_KEY);
  } else {
    memoryOverride = offline;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("bt-connectivity-changed"));
}

export function isForcedOffline(): boolean {
  return readOverride();
}

export function subscribeConnectivity(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  window.addEventListener("bt-connectivity-changed", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
    window.removeEventListener("bt-connectivity-changed", listener);
  };
}
