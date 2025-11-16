import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "viewer";

  if (role === "viewer") {
    redirect("/browse");
  }

  // Fetch submissions if submitter
  let submissions = [];
  if (role === "submitter") {
    const { data } = await supabase
      .from("submissions")
      .select("*")
      .eq("submitter_id", user.id)
      .order("created_at", { ascending: false });
    submissions = data || [];
  }

  // Fetch reviews if reviewer
  let availableReviews = [];
  let myReviews = [];
  if (role === "reviewer") {
    const { data: available } = await supabase
      .from("review_assignments")
      .select("*, papers(title, abstract)")
      .eq("status", "unassigned")
      .order("assigned_at", { ascending: false });
    availableReviews = available || [];

    const { data: completed } = await supabase
      .from("review_submissions")
      .select("*")
      .eq("reviewer_id", user.id)
      .order("created_at", { ascending: false });
    myReviews = completed || [];
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Reputation Score</h3>
          <p className="text-3xl font-bold mt-2">{profile?.reputation_score || 0}</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Wallet Balance</h3>
          <p className="text-3xl font-bold mt-2">
            {profile?.wallet_address
              ? (await import("@/lib/hedera/client")).HederaClient &&
                (await new (await import("@/lib/hedera/client")).HederaClient().getAccountBalance(profile.wallet_address)).hbar + " HBAR"
              : "-- HBAR"}
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Role</h3>
          <p className="text-lg font-semibold mt-2 capitalize">{role}</p>
        </Card>
      </div>

      {/* Role-based content */}
      {role === "submitter" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">My Submissions</h2>
            <Button asChild className="mb-4">
              <Link href="/submit-paper">+ Submit New Paper</Link>
            </Button>
          </div>

          <div className="grid gap-4">
            {submissions.length > 0 ? (
              submissions.map((sub: any) => (
                <Card key={sub.id} className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{sub.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{sub.abstract.substring(0, 100)}...</p>
                      <div className="mt-3 flex gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          sub.status === "finalized" ? "bg-green-100 text-green-800" :
                          sub.status === "under-review" ? "bg-blue-100 text-blue-800" :
                          "bg-yellow-100 text-yellow-800"
                        }`}>
                          {sub.status}
                        </span>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/submissions/${sub.id}`}>View</Link>
                    </Button>
                  </div>
                </Card>
              ))
            ) : (
              <p className="text-muted-foreground">No submissions yet</p>
            )}
          </div>
        </div>
      )}

      {role === "reviewer" && (
        <Tabs defaultValue="available" className="space-y-6">
          <TabsList>
            <TabsTrigger value="available">Available Reviews</TabsTrigger>
            <TabsTrigger value="completed">My Reviews</TabsTrigger>
            <TabsTrigger value="staking">Staking</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-4">
            <h2 className="text-2xl font-bold">Available Review Tasks</h2>
            {availableReviews.length > 0 ? (
              <div className="grid gap-4">
                {availableReviews.map((review: any) => (
                  <Card key={review.id} className="p-6">
                    <h3 className="font-semibold">{review.papers?.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2">{review.papers?.abstract?.substring(0, 100)}...</p>
                    <Button asChild className="mt-4">
                      <Link href={`/reviews/claim/${review.id}`}>Claim Review</Link>
                    </Button>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No available reviews</p>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <h2 className="text-2xl font-bold">My Completed Reviews</h2>
            {myReviews.length > 0 ? (
              <div className="grid gap-4">
                {myReviews.map((review: any) => (
                  <Card key={review.id} className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{review.paper_id}</h3>
                        <p className="text-sm text-muted-foreground mt-1">Status: {review.status}</p>
                      </div>
                      {review.reward_amount && (
                        <p className="font-semibold text-green-600">+{review.reward_amount} HBAR</p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No completed reviews</p>
            )}
          </TabsContent>

          <TabsContent value="staking">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Staking Management</h3>
              <p className="text-muted-foreground mb-4">Minimum stake required: 100 HBAR</p>
              <Button asChild>
                <Link href="/staking">Manage Stake</Link>
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </main>
  );
}
