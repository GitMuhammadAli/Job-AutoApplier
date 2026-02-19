import { getAuthSession } from "@/lib/auth";
import { hasValidAdminSession } from "@/lib/admin-auth";

export function isAdmin(userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(userEmail.toLowerCase());
}

export async function requireAdmin(): Promise<boolean> {
  if (hasValidAdminSession()) return true;
  const session = await getAuthSession();
  return isAdmin(session?.user?.email);
}
