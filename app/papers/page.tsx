import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { redirect } from 'next/navigation';

export default async function PapersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get user profile to determine role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id)
    .single();

  const userRole = profile?.role || "viewer";

  // Redirect admins to admin interface
  if (userRole === "admin") {
    redirect("/admin");
  }

  const { data: papers } = await supabase
    .from("papers")
    .select("*, profiles:author_id(full_name, institution)")
    .order("created_at", { ascending: false });

  // Content varies by role
  const userPapers = papers?.filter(p => p.author_id === user?.id) || [];
  const publishedPapers = papers?.filter(p => p.status === "published") || [];
  
  // For reviewers, get available papers to review from submissions
  let availableForReview = [];
  if (userRole === "reviewer") {
    const { data: submissions } = await supabase
      .from("submissions")
      .select("id, title, abstract, keywords, status, submitter_id")
      .in("status", ["under-review", "submitted"])
      .neq("submitter_id", user?.id); // Don't show papers they submitted
    availableForReview = submissions || [];
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="space-y-8">
        {/* Role-specific first section */}
        {userRole === "submitter" ? (
          /* My Papers Section for submitters */
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">My Papers</h2>
              <Button asChild>
                <Link href="/submit-paper">Submit New Paper</Link>
              </Button>
            </div>

            {userPapers.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-4">
                  You haven&apos;t submitted any papers yet
                </p>
                <Button asChild>
                  <Link href="/submit-paper">Submit Your First Paper</Link>
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4">
                {userPapers.map((paper: any) => (
                  <Card key={paper.id} className="p-6 hover:border-primary/50 transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="text-lg font-semibold text-foreground">
                          {paper.title}
                        </h3>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {paper.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{paper.abstract}</p>
                      <div className="flex gap-2 pt-4">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/papers/${paper.id}`}>View</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/papers/${paper.id}/edit`}>Edit</Link>
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        ) : userRole === "reviewer" ? (
          /* Available to Review Section for reviewers */
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Papers Available for Review</h2>
              <Button asChild variant="outline">
                <Link href="/reviews">Go to Reviews Dashboard</Link>
              </Button>
            </div>

            {availableForReview.length === 0 ? (
              <Card className="p-8 text-center">
                <h3 className="text-lg font-medium mb-2">No Papers Awaiting Review</h3>
                <p className="text-muted-foreground mb-4">
                  There are currently no papers available for review that match your expertise.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button asChild variant="outline">
                    <Link href="/profile">Update Expertise</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/staking">Manage Staking</Link>
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4">
                {availableForReview.map((paper: any) => (
                  <Card key={paper.id} className="p-6 hover:border-primary/50 transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="text-lg font-semibold text-foreground">
                          {paper.title}
                        </h3>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Available for Review
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{paper.abstract}</p>
                      {paper.keywords && (
                        <p className="text-xs text-muted-foreground">
                          Keywords: {paper.keywords.join(", ")}
                        </p>
                      )}
                      <div className="flex gap-2 pt-4">
                        <Button asChild>
                          <Link href={`/papers/${paper.id}`}>Review Paper</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/submissions/${paper.id}`}>View Submission</Link>
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        ) : (
          /* Browse Papers Section for viewers and others */
          <section>
            <h2 className="text-2xl font-bold mb-6">Browse Research Papers</h2>
            <Card className="p-8 text-center">
              <h3 className="text-lg font-medium mb-2">Welcome to ResearchHub</h3>
              <p className="text-muted-foreground mb-4">
                {userRole === "viewer" 
                  ? "Complete your profile to become a submitter or reviewer and access more features."
                  : "Explore published research papers from our community."}
              </p>
              {userRole === "viewer" && (
                <Button asChild>
                  <Link href="/profile">Update Profile</Link>
                </Button>
              )}
            </Card>
          </section>
        )}

        {/* Published Papers Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Published Research</h2>
          {publishedPapers.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No published papers yet
            </Card>
          ) : (
            <div className="grid gap-4">
              {publishedPapers.map((paper: any) => (
                <Card key={paper.id} className="p-6 hover:border-primary/50 transition-colors">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {paper.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      By {paper.profiles?.full_name || "Unknown"} • {paper.profiles?.institution}
                    </p>
                    <p className="text-sm text-muted-foreground">{paper.abstract}</p>
                    <div className="flex items-center gap-4 pt-4 text-xs text-muted-foreground">
                      <span>{paper.view_count || 0} views</span>
                      <span>{paper.citation_count || 0} citations</span>
                      {paper.blockchain_hash && (
                        <span className="text-green-600 dark:text-green-400">✓ Verified</span>
                      )}
                    </div>
                    <Button asChild variant="outline" size="sm" className="mt-4">
                      <Link href={`/papers/${paper.id}`}>Read Paper</Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
