import { createClient } from "@/lib/supabase/server";
import { redirect } from 'next/navigation';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import LogoutButton from "@/components/logout-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile with role for secure admin check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin';

  // Redirect admins to their dedicated admin interface
  if (isAdmin) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-foreground">
            ResearchHub
          </Link>
          <div className="flex gap-2 md:gap-4 items-center">
            <Button variant="ghost" asChild size="sm" className="hidden md:inline-flex">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button variant="ghost" asChild size="sm" className="hidden md:inline-flex">
              <Link href="/wallet">Wallet</Link>
            </Button>
            <Button variant="ghost" asChild size="sm" className="hidden md:inline-flex">
              <Link href="/papers">Papers</Link>
            </Button>
            <Button variant="ghost" asChild size="sm" className="hidden md:inline-flex">
              <Link href="/reviews">Reviews</Link>
            </Button>
            <Button variant="ghost" asChild size="sm" className="hidden md:inline-flex">
              <Link href="/profile">Profile</Link>
            </Button>
            <LogoutButton />
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
