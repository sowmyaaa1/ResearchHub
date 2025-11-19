"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Users, Activity, Clock, Award } from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_reviewer: boolean;
  hedera_account_id?: string;
  created_at: string;
  papers_submitted: number;
  reviews_completed: number;
  current_stake?: number;
  last_sign_in_at?: string;
}

interface AdminStats {
  total_users: number;
  total_papers: number;
  total_reviews: number;
  papers_by_status: Record<string, number>;
  users_by_role: Record<string, number>;
  recent_submissions: number;
  active_reviewers: number;
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    setLoading(true);

    try {
      // Load user data
      const { data: userData, error: userError } = await supabase
        .from('admin_user_management')
        .select('*')
        .order('created_at', { ascending: false });

      if (userError) {
        console.error('Error loading users:', userError);
        setMessage({ type: 'error', text: 'Failed to load user data' });
      } else {
        setUsers(userData || []);
      }

      // Load dashboard stats
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_admin_dashboard_stats');

      if (statsError) {
        console.error('Error loading stats:', statsError);
      } else {
        setStats(statsData);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load admin data' });
    } finally {
      setLoading(false);
    }
  }

  async function updateUserRole(userId: string, newRole: string) {
    const supabase = createClient();
    setUpdating(userId);

    try {
      const { error } = await supabase.rpc('set_user_role', {
        user_id: userId,
        new_role: newRole
      });

      if (error) throw error;

      setMessage({ 
        type: 'success', 
        text: `User role updated to ${newRole}` 
      });

      // Reload data
      await loadData();

    } catch (error) {
      console.error('Error updating user role:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to update user role' 
      });
    } finally {
      setUpdating(null);
    }
  }

  function getRoleBadgeVariant(role: string) {
    switch (role) {
      case 'admin': return 'destructive';
      case 'reviewer': return 'default';
      case 'author': return 'secondary';
      case 'viewer': return 'outline';
      default: return 'outline';
    }
  }

  if (loading) {
    return <div className="p-4">Loading admin data...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">User Management</h2>
        <p className="text-muted-foreground">
          Manage user roles and monitor platform activity
        </p>
      </div>

      {message && (
        <Alert className={message.type === 'error' ? 'border-red-500' : 'border-green-500'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Total Users</p>
                  <p className="text-2xl font-bold">{stats.total_users}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Active Reviewers</p>
                  <p className="text-2xl font-bold">{stats.active_reviewers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-sm font-medium">Recent Submissions</p>
                  <p className="text-2xl font-bold">{stats.recent_submissions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Award className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-sm font-medium">Total Reviews</p>
                  <p className="text-2xl font-bold">{stats.total_reviews}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Role Distribution */}
      {stats?.users_by_role && (
        <Card>
          <CardHeader>
            <CardTitle>Role Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(stats.users_by_role).map(([role, count]) => (
                <div key={role} className="text-center p-3 border rounded-lg">
                  <Badge variant={getRoleBadgeVariant(role)} className="mb-2">
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Badge>
                  <p className="text-lg font-bold">{count}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Stake</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.full_name || 'Unnamed User'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        {user.hedera_account_id && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {user.hedera_account_id}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role}
                      </Badge>
                      {user.is_reviewer && (
                        <Badge variant="outline" className="ml-1">
                          Reviewer
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <div className={`h-2 w-2 rounded-full ${
                          user.last_sign_in_at && 
                          new Date(user.last_sign_in_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                            ? 'bg-green-500'
                            : 'bg-gray-400'
                        }`} />
                        <span className="text-sm">
                          {user.last_sign_in_at 
                            ? new Date(user.last_sign_in_at).toLocaleDateString()
                            : 'Never'
                          }
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{user.papers_submitted} papers</p>
                        <p>{user.reviews_completed} reviews</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.current_stake ? (
                        <span className="text-sm font-medium">
                          {user.current_stake} HBAR
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No stake
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={user.role}
                        onValueChange={(newRole: string) => updateUserRole(user.id, newRole)}
                        disabled={updating === user.id}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="author">Author</SelectItem>
                          <SelectItem value="reviewer">Reviewer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Security Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Access Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>• <strong>Admin Role:</strong> Full access to admin dashboard and user management</p>
          <p>• <strong>Reviewer Role:</strong> Can review papers and stake HBAR</p>
          <p>• <strong>Author Role:</strong> Can submit papers and participate in platform</p>
          <p>• <strong>Viewer Role:</strong> Read-only access to published content</p>
          <p>• <strong>Security:</strong> All role changes are logged and audited</p>
        </CardContent>
      </Card>
    </div>
  );
}