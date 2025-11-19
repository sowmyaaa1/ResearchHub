
import { createClient } from "@/lib/supabase/server";
import { redirect } from 'next/navigation';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import LogoutButton from "@/components/logout-button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile and verify admin access
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Only admins can access admin interface
  if (profile?.role !== 'admin') {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Navigation */}
      <nav className="border-b border-border bg-red-50 dark:bg-red-950 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/admin" className="text-xl font-bold text-foreground flex items-center gap-2">
            <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">ADMIN</span>
            ResearchHub
          </Link>
          <div className="flex gap-2 md:gap-4 items-center">
            <Button variant="ghost" asChild size="sm" className="hidden md:inline-flex">
              <Link href="/admin">Dashboard</Link>
            </Button>
            <Button variant="ghost" asChild size="sm" className="hidden md:inline-flex">
              <Link href="/admin/configure-rules">Review Rules</Link>
            </Button>
            <Button variant="ghost" asChild size="sm" className="hidden md:inline-flex">
              <Link href="/admin/papers">Manage Papers</Link>
            </Button>
            <Button variant="ghost" asChild size="sm" className="hidden md:inline-flex">
              <Link href="/admin/users">User Management</Link>
            </Button>
            <Button variant="ghost" asChild size="sm" className="hidden md:inline-flex">
              <Link href="/admin/security">Security</Link>
            </Button>
            <LogoutButton />
          </div>
        </div>
      </nav>
      
      {/* Admin Content Area */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}