export interface AclPolicy {
  allowedUsers?: string[];
  isPublic?: boolean;
}

export function checkAccess(policy: AclPolicy, userId?: string): boolean {
  if (policy.isPublic) return true;
  if (!userId) return false;
  if (policy.allowedUsers && policy.allowedUsers.includes(userId)) return true;
  return false;
}
