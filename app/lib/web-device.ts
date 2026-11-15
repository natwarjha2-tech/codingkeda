/**
 * Website (browser) identity for the device limit. A browser counts as a
 * computer: a random id is kept in this browser's localStorage, so the website
 * follows the same "one device at a time" rule as the apps.
 * Browser-only — import from client components.
 */
const KEY = "ck_web_device_id";

export interface WebDevice {
  id: string;
  kind: "desktop";
  name: string;
  platform: "web";
  appVersion: string;
}

function browserName(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "Browser";
}

function osName(ua: string): string {
  if (/Windows/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "";
}

export function getWebDevice(): WebDevice | null {
  if (typeof window === "undefined") return null;
  let id = "";
  try { id = localStorage.getItem(KEY) || ""; } catch { /* storage blocked */ }
  if (!/^[A-Za-z0-9._:-]{8,100}$/.test(id)) {
    const rnd = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    id = `w-${rnd}`;
    try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
  }
  const ua = navigator.userAgent || "";
  const os = osName(ua);
  return {
    id,
    kind: "desktop",
    name: `${browserName(ua)} browser${os ? ` on ${os}` : ""}`,
    platform: "web",
    appVersion: "web",
  };
}

/** Ask "use this device instead?" for a DEVICE_LIMIT answer from the server. */
export function confirmReplaceDevice(data: { message?: string; switchesLeft?: number }): boolean {
  const left = typeof data.switchesLeft === "number"
    ? `\n\nYou can change your device ${data.switchesLeft} more time${data.switchesLeft === 1 ? "" : "s"} this month.`
    : "";
  return window.confirm(`${data.message || "This account is already used on another device. Use this one instead?"}${left}`);
}
