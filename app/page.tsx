import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { redirect } from 'next/navigation';
import { ThemeToggle } from "@/components/theme-toggle";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role || "viewer";
    if (role === "submitter" || role === "reviewer") {
      redirect("/dashboard");
    }
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-foreground">
            ResearchHub
          </Link>
          <div className="flex gap-2 items-center">
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4 py-20 text-center">
        <div className="max-w-3xl">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
            Decentralized Scientific Publishing
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            A transparent peer-review system powered by Hedera blockchain. Researchers submit papers, reviewers stake and earn rewards, and every publication is immutably verified.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
              <Link href="/signup">Get Started</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/browse">Browse Papers</Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 max-w-5xl">
          <Card className="p-6 border border-border">
            <h3 className="text-xl font-semibold mb-2">Submit Research</h3>
            <p className="text-sm text-muted-foreground">
              Upload papers and code. Pay submission fee in HBAR. Track reviews in real-time.
            </p>
          </Card>
          <Card className="p-6 border border-border">
            <h3 className="text-xl font-semibold mb-2">Stake & Review</h3>
            <p className="text-sm text-muted-foreground">
              Reviewers stake HBAR, claim tasks, and earn rewards for quality reviews.
            </p>
          </Card>
          <Card className="p-6 border border-border">
            <h3 className="text-xl font-semibold mb-2">Blockchain Verified</h3>
            <p className="text-sm text-muted-foreground">
              Every submission and review is recorded on Hedera for complete transparency.
            </p>
          </Card>
        </div>
      </div>
    </main>
  );
}
