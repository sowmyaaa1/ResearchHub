// Admin Setup Guide Component
// Helps with initial admin user setup and security configuration

"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react';

export default function AdminSetupGuide() {
  const [setupComplete, setSetupComplete] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');

  const setupSteps = [
    {
      title: "1. Database Migration",
      description: "Run the admin security migration",
      command: "npx supabase migration up --file 019_secure_admin_access.sql",
      completed: false
    },
    {
      title: "2. Create First Admin User", 
      description: "Set up the initial admin account",
      command: "Update the migration file with your admin email",
      completed: false
    },
    {
      title: "3. Verify Role-Based Access",
      description: "Test that only admin users can access admin dashboard",
      command: "Try accessing /admin with different user roles",
      completed: false
    },
    {
      title: "4. Review Security Logs",
      description: "Monitor admin access attempts in the logs",
      command: "Check server logs for admin access attempts",
      completed: false
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin Security Setup</h1>
        <p className="text-muted-foreground">
          Complete these steps to secure your admin dashboard
        </p>
      </div>

      <Alert className="border-orange-500">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Security Notice:</strong> The admin dashboard is now protected with role-based access control. 
          Only users with the 'admin' role can access administrative functions.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Setup Steps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Setup Steps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {setupSteps.map((step, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  {step.completed ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                  )}
                  <h3 className="font-medium">{step.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {step.description}
                </p>
                <code className="text-xs bg-muted p-2 rounded block">
                  {step.command}
                </code>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security Features */}
        <Card>
          <CardHeader>
            <CardTitle>Security Features Implemented</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Role-based access control</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Middleware route protection</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Admin action audit logging</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Secure user role management</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Automatic security conflict detection</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Database-level access constraints</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin User Setup */}
      <Card>
        <CardHeader>
          <CardTitle>First Admin User Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              To create your first admin user, you'll need to manually update the database.
              Future admin users can be promoted through the admin dashboard.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div>
              <Label htmlFor="admin-email">Admin Email</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@yourcompany.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">SQL Command to Run:</h4>
              <code className="text-sm">
                {`UPDATE profiles SET role = 'admin' WHERE email = '${adminEmail || 'your-admin-email@example.com'}';`}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle>Security Best Practices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>• <strong>Principle of Least Privilege:</strong> Only grant admin role to users who absolutely need it</p>
          <p>• <strong>Regular Audits:</strong> Review admin action logs regularly for suspicious activity</p>
          <p>• <strong>Strong Authentication:</strong> Ensure admin users have strong passwords and MFA enabled</p>
          <p>• <strong>Role Monitoring:</strong> Monitor role changes through the audit system</p>
          <p>• <strong>Access Logging:</strong> All admin access attempts are logged with user details</p>
          <p>• <strong>Environment Separation:</strong> Use different admin accounts for development and production</p>
        </CardContent>
      </Card>
    </div>
  );
}