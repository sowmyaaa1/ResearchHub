import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from 'next/navigation';
import ClaimReviewButton from "@/components/claim-review-button";
import PaperReviewActions from "@/components/paper-review-actions";

export default async function PaperDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Get paper data without foreign key join to avoid RLS issues
  const { data: paper, error: paperError } = await supabase
    .from("papers")
    .select("*")
    .eq("id", id)
    .single();

  console.log("Paper detail - Paper:", paper);
  console.log("Paper detail - Error:", paperError);

  if (!paper || paperError) {
    console.error("Paper not found or error:", paperError);
    notFound();
  }

  // Get author information separately
  const { data: author } = await supabase
    .from("profiles")
    .select("full_name, institution, avatar_url")
    .eq("id", paper.author_id)
    .single();

  // Fetch submission for this paper
  const { data: submission } = await supabase
    .from("submissions")
    .select("id")
    .eq("paper_id", id)
    .single();
  const submissionId = submission?.id || null;

  // Get reviews from review_submissions table (linked via assignments)
  const { data: reviews } = await supabase
    .from("review_submissions")
    .select(`
      *,
      profiles(full_name),
      review_assignments!inner(paper_id)
    `)
    .eq("review_assignments.paper_id", id)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  // Fetch assignment for logged-in reviewer
  const { data: { user } } = await supabase.auth.getUser();
  let assignmentId: string | null = null;
  if (user) {
    const { data: assignment } = await supabase
      .from("review_assignments")
      .select("id")
      .eq("paper_id", id)
      .eq("reviewer_id", user.id)
      .not("status", "eq", "completed")
      .single();
    assignmentId = assignment?.id || null;
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Paper Header */}
        <Card className="p-8 border-0 bg-card/50">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-foreground">{paper.title}</h1>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{author?.full_name || "Unknown Author"}</span>
              <span>•</span>
              <span>{author?.institution}</span>
              <span>•</span>
              <span>{new Date(paper.created_at).toLocaleDateString()}</span>
            </div>

            {paper.keywords && paper.keywords.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {paper.keywords.map((keyword: string) => (
                  <span
                    key={keyword}
                    className="px-3 py-1 rounded-full text-xs bg-primary/10 text-primary"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Abstract */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Abstract</h2>
          <p className="text-muted-foreground leading-relaxed">{paper.abstract}</p>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{paper.view_count || 0}</p>
            <p className="text-sm text-muted-foreground">Views</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{paper.citation_count || 0}</p>
            <p className="text-sm text-muted-foreground">Citations</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              {reviews?.length || 0}
            </p>
            <p className="text-sm text-muted-foreground">Reviews</p>
          </Card>
        </div>

        {/* PDF Link */}
        {paper.pdf_url && (
          <div>
            <Button asChild size="lg" className="w-full">
              <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer">
                Download Full Paper (PDF)
              </a>
            </Button>
          </div>
        )}

        {/* Blockchain Verification */}
        {paper.blockchain_hash && (
          <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <p className="text-sm text-green-800 dark:text-green-400">
              ✓ This paper is verified and recorded on Hedera blockchain
            </p>
            <p className="text-xs text-green-600 dark:text-green-500 mt-1 font-mono">
              Hash: {paper.blockchain_hash.slice(0, 16)}...
            </p>
          </Card>
        )}

        {/* Reviews Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Peer Reviews ({reviews?.length || 0})</h2>
          {(!reviews || reviews.length === 0) ? (
            <Card className="p-6 text-center text-muted-foreground">
              No reviews yet
            </Card>
          ) : (
            <div className="space-y-4">
              {reviews.map((review: any) => (
                <Card key={review.id} className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">
                          {review.profiles?.full_name || "Anonymous Reviewer"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground capitalize">
                          {review.recommendation}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Novelty</p>
                        <p className="text-sm font-semibold">{review.novelty_score}/5</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Technical</p>
                        <p className="text-sm font-semibold">{review.technical_correctness_score}/5</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Clarity</p>
                        <p className="text-sm font-semibold">{review.clarity_score}/5</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Significance</p>
                        <p className="text-sm font-semibold">{review.significance_score}/5</p>
                      </div>
                    </div>
                    
                    {review.comments && (
                      <div>
                        <p className="text-sm font-medium mb-1">Comments</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.comments}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Review Paper Button for reviewers */}
        {paper.status !== "published" && assignmentId && (
          <Button asChild className="w-full mt-4">
            <Link href={`/reviews/submit/${assignmentId}`}>Review Paper</Link>
          </Button>
        )}
        {/* Claim Review Button if no assignment exists */}
        {paper.status !== "published" && !assignmentId && user && (
          <div>
            <PaperReviewActions paperId={paper.id} reviewerId={user.id} />
          </div>
        )}

        <Button asChild variant="outline" className="w-full">
          <Link href="/browse">Back to Papers</Link>
        </Button>
      </div>
    </main>
  );
}
