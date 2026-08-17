import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "";

// Validate JWT_SECRET strength at module load time (fail-fast)
if (SECRET.length < 32) {
  throw new Error(
    `JWT_SECRET must be at least 32 characters (current: ${SECRET.length}). ` +
    `Use a cryptographically random string. Generate one with: openssl rand -base64 48`
  );
}

export type JwtPayload = {
  userId: string;
  email: string;
  role: string;
};

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { algorithm: "HS256", expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET, { algorithms: ["HS256"] }) as JwtPayload;
}
