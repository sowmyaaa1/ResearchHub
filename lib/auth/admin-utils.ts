// Utility for checking admin role securely on both client and server
import { createClient } from '@/lib/supabase/server';
import { createClient as createClientClient } from '@/lib/supabase/client';

/**
 * Server-side admin role check
 * Use this in server components and API routes
 */
export async function checkIsAdminServer(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      console.error('Error checking admin role (server):', error);
      return false;
    }

    return profile.role === 'admin';
  } catch (error) {
    console.error('Error in admin role check (server):', error);
    return false;
  }
}

/**
 * Client-side admin role check
 * Use this in client components
 */
export async function checkIsAdminClient(userId: string): Promise<boolean> {
  try {
    const supabase = createClientClient();
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      console.error('Error checking admin role (client):', error);
      return false;
    }

    return profile.role === 'admin';
  } catch (error) {
    console.error('Error in admin role check (client):', error);
    return false;
  }
}

/**
 * Get user role securely (server-side)
 */
export async function getUserRoleServer(userId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      console.error('Error getting user role (server):', error);
      return null;
    }

    return profile.role;
  } catch (error) {
    console.error('Error in user role check (server):', error);
    return null;
  }
}

/**
 * Admin role validation for API routes
 * Throws error if user is not admin
 */
export async function requireAdminRole(userId: string, supabaseInstance?: any): Promise<void> {
  const supabase = supabaseInstance || await createClient();
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    throw new Error('User not found');
  }

  if (profile.role !== 'admin') {
    // Log unauthorized access attempt
    console.warn(`Unauthorized admin access attempt by ${profile.email} (${userId}) with role: ${profile.role}`);
    throw new Error('Admin privileges required');
  }
}

/**
 * Role-based access levels
 */
export const USER_ROLES = {
  ADMIN: 'admin',
  REVIEWER: 'reviewer', 
  SUBMITTER: 'submitter',
  VIEWER: 'viewer'
} as const;

/**
 * Check if user has minimum required role
 */
export function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  const roleHierarchy = {
    [USER_ROLES.VIEWER]: 0,
    [USER_ROLES.SUBMITTER]: 1,
    [USER_ROLES.REVIEWER]: 2,
    [USER_ROLES.ADMIN]: 3
  };

  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] ?? -1;
  const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] ?? 999;

  return userLevel >= requiredLevel;
}