export function isAdmin(userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(userEmail.toLowerCase());
}
