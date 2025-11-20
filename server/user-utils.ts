import type { User } from "@shared/schema";

export type SafeUser = Omit<User, 'passwordHash'>;

export function sanitizeUser(user: User | undefined): SafeUser | undefined {
  if (!user) return undefined;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export function sanitizeUsers(users: User[]): SafeUser[] {
  return users.map(sanitizeUser).filter((u): u is SafeUser => u !== undefined);
}
