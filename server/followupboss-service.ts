const FUB_API_BASE = 'https://api.followupboss.com/v1';

export interface FUBUser {
  id: number;
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  isActive?: boolean;
}

export interface FUBResult {
  configured: boolean;
  users: FUBUser[];
  error?: string;
}

export function isFUBConfigured(): boolean {
  return !!process.env.FUB_API_KEY;
}

export async function getFUBTeamMembers(): Promise<FUBResult> {
  const apiKey = process.env.FUB_API_KEY;
  
  if (!apiKey) {
    return { configured: false, users: [] };
  }
  
  try {
    const response = await fetch(`${FUB_API_BASE}/users`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[FUB] API error:', response.status, error);
      return { configured: true, users: [], error: `API error: ${response.status}` };
    }
    
    const data = await response.json();
    const users = data.users || [];
    
    const mappedUsers: FUBUser[] = users.map((user: any) => ({
      id: user.id,
      name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive !== false,
    }));
    
    return { configured: true, users: mappedUsers };
  } catch (error: any) {
    console.error('[FUB] Failed to fetch users:', error.message);
    return { configured: true, users: [], error: error.message };
  }
}

export async function searchFUBTeamMembers(query: string): Promise<FUBResult> {
  const result = await getFUBTeamMembers();
  
  if (!result.configured || result.users.length === 0) {
    return result;
  }
  
  const lowerQuery = query.toLowerCase();
  const filteredUsers = result.users.filter(user => 
    user.name?.toLowerCase().includes(lowerQuery) ||
    user.email?.toLowerCase().includes(lowerQuery)
  );
  
  return { ...result, users: filteredUsers };
}
