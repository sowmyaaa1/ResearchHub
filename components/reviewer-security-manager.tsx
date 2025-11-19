"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ReviewerConflict {
  conflict_type: string;
  user_id: string;
  user_name: string;
  hedera_account: string;
  paper_id: string;
  paper_title: string;
  issue_description: string;
}

interface ReviewerStatusAudit {
  id: string;
  user_id: string;
  old_status: boolean;
  new_status: boolean;
  reason: string;
  changed_at: string;
  profiles: {
    full_name: string;
    hedera_account_id: string;
  };
}

export default function ReviewerSecurityManager() {
  const [conflicts, setConflicts] = useState<ReviewerConflict[]>([]);
  const [auditLog, setAuditLog] = useState<ReviewerStatusAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    setLoading(true);

    try {
      // Load conflicts
      const { data: conflictsData, error: conflictsError } = await supabase
        .rpc('check_author_reviewer_conflicts');

      if (conflictsError) {
        console.error('Error loading conflicts:', conflictsError);
      } else {
        setConflicts(conflictsData || []);
      }

      // Load audit log
      const { data: auditData, error: auditError } = await supabase
        .from('reviewer_status_audit')
        .select(`
          *,
          profiles:user_id(full_name, hedera_account_id)
        `)
        .order('changed_at', { ascending: false })
        .limit(100);

      if (auditError) {
        console.error('Error loading audit log:', auditError);
      } else {
        setAuditLog(auditData || []);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load security data' });
    } finally {
      setLoading(false);
    }
  }

  async function resolveConflict(conflict: ReviewerConflict, action: 'remove_reviewer' | 'remove_assignment') {
    const supabase = createClient();
    setResolving(conflict.user_id);

    try {
      if (action === 'remove_reviewer') {
        // Remove reviewer status from user
        const { error } = await supabase.rpc('set_reviewer_status', {
          user_id: conflict.user_id,
          is_reviewer_new: false
        });

        if (error) throw error;
        
        setMessage({ 
          type: 'success', 
          text: `Removed reviewer status from ${conflict.user_name}` 
        });

      } else if (action === 'remove_assignment') {
        // Remove specific assignment
        const { error } = await supabase
          .from('expertise_matching')
          .delete()
          .eq('paper_id', conflict.paper_id)
          .eq('profile_id', conflict.user_id);

        if (error) throw error;

        setMessage({ 
          type: 'success', 
          text: `Removed assignment for ${conflict.user_name} from paper "${conflict.paper_title}"` 
        });
      }

      // Reload data
      await loadData();

    } catch (error) {
      console.error('Error resolving conflict:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to resolve conflict' 
      });
    } finally {
      setResolving(null);
    }
  }

  if (loading) {
    return <div className="p-4">Loading security data...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Reviewer Security Manager</h2>
        <p className="text-muted-foreground">
          Detect and resolve author-reviewer conflicts to ensure review integrity
        </p>
      </div>

      {message && (
        <Alert className={message.type === 'error' ? 'border-red-500' : 'border-green-500'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="conflicts" className="w-full">
        <TabsList>
          <TabsTrigger value="conflicts">
            Active Conflicts ({conflicts.length})
          </TabsTrigger>
          <TabsTrigger value="audit">
            Audit Log ({auditLog.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conflicts">
          <Card>
            <CardHeader>
              <CardTitle>Author-Reviewer Conflicts</CardTitle>
            </CardHeader>
            <CardContent>
              {conflicts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  ✅ No conflicts detected. Review system integrity is maintained.
                </div>
              ) : (
                <div className="space-y-4">
                  {conflicts.map((conflict, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={conflict.conflict_type === 'author_is_reviewer' ? 'destructive' : 'default'}>
                              {conflict.conflict_type.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <span className="font-medium">{conflict.user_name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            {conflict.issue_description}
                          </p>
                          <p className="text-sm">
                            <strong>Paper:</strong> {conflict.paper_title}
                          </p>
                          <p className="text-sm">
                            <strong>Hedera Account:</strong> {conflict.hedera_account}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveConflict(conflict, 'remove_assignment')}
                          disabled={resolving === conflict.user_id}
                        >
                          Remove Assignment
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => resolveConflict(conflict, 'remove_reviewer')}
                          disabled={resolving === conflict.user_id}
                        >
                          Revoke Reviewer Status
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Reviewer Status Changes</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLog.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No reviewer status changes recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLog.map((entry) => (
                    <div key={entry.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium">{entry.profiles?.full_name || 'Unknown User'}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            ({entry.profiles?.hedera_account_id})
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.changed_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={entry.old_status ? 'default' : 'secondary'}>
                          {entry.old_status ? 'Reviewer' : 'Non-Reviewer'}
                        </Badge>
                        <span>→</span>
                        <Badge variant={entry.new_status ? 'default' : 'secondary'}>
                          {entry.new_status ? 'Reviewer' : 'Non-Reviewer'}
                        </Badge>
                      </div>
                      {entry.reason && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Reason: {entry.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Security Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>• <strong>Author-Reviewer Conflicts:</strong> Authors cannot review their own papers</p>
          <p>• <strong>Hedera Account Conflicts:</strong> Same Hedera account cannot be both author and reviewer</p>
          <p>• <strong>Automatic Prevention:</strong> Database constraints prevent new conflicts</p>
          <p>• <strong>Reviewer Assignment:</strong> Only expertise-matched reviewers are auto-assigned</p>
          <p>• <strong>Staking Requirement:</strong> Users must stake HBAR to become reviewers</p>
        </CardContent>
      </Card>
    </div>
  );
}