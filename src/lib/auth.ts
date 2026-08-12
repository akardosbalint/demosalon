import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
  verifySessionToken,
} from "@/lib/session";

// Node-only (bcryptjs) — password hashing for the login Server Action and
// the seed script. Kept separate from src/lib/session.ts so Edge middleware
// never has to load bcryptjs.

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** For Server Components/Actions under /admin — middleware already blocks
 * unauthenticated requests, this just resolves who's logged in. */
export async function getCurrentAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return null;
  return prisma.adminUser.findUnique({ where: { id: session.adminId } });
}
