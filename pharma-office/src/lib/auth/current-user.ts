import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { readSessionUserId } from "./session";
import { can, type AccessSubject, type Permission, type Role } from "./permissions";

export type CurrentUser = AccessSubject & {
  fullName: string;
  fullNameAr: string | null;
  email: string;
};

/**
 * Data Access Layer entry point: verifies the session and re-reads the user
 * from the database on every request, so deactivating a user or changing a
 * role takes effect immediately. Deduplicated per request with React cache().
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;
  const [row] = await getDb()
    .select({
      id: users.id,
      role: users.role,
      territoryId: users.territoryId,
      financialAccess: users.financialAccess,
      fullName: users.fullName,
      fullNameAr: users.fullNameAr,
      email: users.email,
      active: users.active,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row || !row.active) return null;
  const { active: _active, ...user } = row;
  void _active;
  return { ...user, role: row.role as Role };
});

export async function requireUser(lang: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/login`);
  return user;
}

export function hasPermission(user: CurrentUser, permission: Permission): boolean {
  return can(user, permission);
}
