/**
 * app/lib/api.ts
 * Frontend → Backend API helper.
 * Only allows same-origin /api/* calls — prevents SSRF.
 */

const ALLOWED_PREFIX = "/api/";

async function request(url: string, body: object) {
  // SSRF prevention — only allow internal /api/ routes (CWE-918)
  if (!url.startsWith(ALLOWED_PREFIX)) {
    throw new Error(`Invalid API path: ${url}`);
  }

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  return res.json();
}

export const api = {
  post: request,
};
