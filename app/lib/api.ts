/**
 * app/lib/api.ts
 *
 * One helper for ALL frontend → backend calls.
 * Use this instead of writing fetch() manually every time.
 *
 * Usage examples:
 *   const data = await api.post("/api/auth/login", { email, password });
 *   const data = await api.post("/api/survey/lead", { name, email });
 */

async function request(url: string, body: object) {
  // Automatically attach the JWT token if the user is logged in
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return data; // always returns { success, message, ...rest }
}

export const api = {
  post: request,
};
