/**
 * Browser helper: must this student verify a parent before using the site?
 * True only when the deadline has passed. Any problem (offline, server error)
 * counts as "no", so a hiccup never locks anyone out.
 */
export async function consentBlocked(token: string): Promise<boolean> {
  try {
    const res = await fetch("/api/student/consent", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return false;
    const data = await res.json();
    const c = data?.consent;
    return !!(c && c.enabled && c.required && !c.verified && c.blocked);
  } catch {
    return false;
  }
}
