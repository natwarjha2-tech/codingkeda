/**
 * CodingKida — Push Notification Provider Adapters
 * 
 * Abstraction layer for push delivery.
 * Currently supports:
 *   - Expo Push (Android/iOS via Expo Push Service — free, no FCM config needed)
 *   - Desktop (no push — sync-based, native OS notification triggered client-side)
 * 
 * Future: Add FCM, APNs, Email adapters without modifying core notification logic.
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface PushPayload {
  to: string; // push token (e.g., "ExponentPushToken[xxx]")
  title: string;
  body: string;
  data?: Record<string, unknown>; // { notificationId, type }
  priority?: "default" | "normal" | "high";
  sound?: "default" | null;
}

export interface PushResult {
  success: boolean;
  invalidToken?: boolean; // true = token expired/invalid, should deactivate device
  error?: string;
}

// ═══════════════════════════════════════════════════════
// EXPO PUSH ADAPTER (Android + iOS)
// ═══════════════════════════════════════════════════════

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Send push notification via Expo Push Service.
 * Supports batching (up to 100 per request).
 * No server credentials needed — Expo Push is free and open.
 * 
 * @param messages - Array of push payloads
 * @returns Array of results matching input order
 */
export async function sendExpoPush(messages: PushPayload[]): Promise<PushResult[]> {
  if (messages.length === 0) return [];

  // Validate tokens — only send to valid Expo push tokens
  const validMessages = messages.filter(
    (m) => m.to && m.to.startsWith("ExponentPushToken[")
  );

  if (validMessages.length === 0) {
    return messages.map(() => ({ success: false, error: "Invalid token format" }));
  }

  try {
    // Expo Push API accepts up to 100 messages per request
    const chunks = chunkArray(validMessages, 100);
    const allResults: PushResult[] = [];

    for (const chunk of chunks) {
      const expoMessages = chunk.map((msg) => ({
        to: msg.to,
        title: msg.title,
        body: msg.body,
        data: msg.data || {},
        priority: msg.priority || "high",
        sound: msg.sound || "default",
        channelId: "default",
      }));

      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expoMessages),
      });

      if (!res.ok) {
        // Entire batch failed
        const errorText = await res.text().catch(() => "");
        chunk.forEach(() =>
          allResults.push({ success: false, error: `Expo API error: ${res.status} ${errorText}` })
        );
        continue;
      }

      const responseData = await res.json();
      const tickets = responseData.data || [];

      for (let i = 0; i < chunk.length; i++) {
        const ticket = tickets[i];
        if (!ticket) {
          allResults.push({ success: false, error: "No ticket returned" });
        } else if (ticket.status === "ok") {
          allResults.push({ success: true });
        } else if (ticket.status === "error") {
          const isInvalid =
            ticket.details?.error === "DeviceNotRegistered" ||
            ticket.details?.error === "InvalidCredentials";
          allResults.push({
            success: false,
            invalidToken: isInvalid,
            error: ticket.message || ticket.details?.error || "Push failed",
          });
        } else {
          allResults.push({ success: false, error: "Unknown ticket status" });
        }
      }
    }

    return allResults;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Network error";
    return messages.map(() => ({ success: false, error: errMsg }));
  }
}

/**
 * Check if a push token is a valid Expo push token format.
 */
export function isValidExpoPushToken(token: string): boolean {
  return !!token && token.startsWith("ExponentPushToken[") && token.endsWith("]");
}

// ═══════════════════════════════════════════════════════
// DESKTOP ADAPTER (No external push — sync-based)
// ═══════════════════════════════════════════════════════

/**
 * Desktop notifications are delivered via:
 * 1. Client-side sync (GET /api/notifications on app open/focus)
 * 2. Native OS toast triggered by Electron main process (IPC)
 * 
 * No server-side push needed for desktop — just mark outbox as delivered.
 */
export function isDesktopDevice(platform: string): boolean {
  return platform === "desktop";
}

// ═══════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
