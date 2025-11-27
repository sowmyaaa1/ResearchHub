import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import PaperReviewActions from "@/components/paper-review-actions";

export default async function SubmissionPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: { payment?: string };
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: submission } = await supabase
    .from("submissions")
    .select("*, profiles(full_name, reputation_score)")
    .eq("id", params.id)
    .single();

  if (!submission) {
    return <div className="text-center py-12">Submission not found</div>;
  }

  // Get reviews for this paper (handle multiple assignment linking patterns)
  const { data: reviewsBySubmission } = await supabase
    .from("review_submissions")
    .select("*, profiles(full_name)")
    .eq("submission_id", params.id)
    .eq("status", "completed");

  // Try assignment lookup by actual paper_id
  const { data: reviewsByAssignment1 } = await supabase
    .from("review_submissions")
    .select(`
      *,
      profiles(full_name),
      review_assignments!inner(paper_id)
    `)
    .eq("review_assignments.paper_id", submission.paper_id)
    .eq("status", "completed");

  // Also try assignment lookup by submission_id (for data consistency issues)
  const { data: reviewsByAssignment2 } = await supabase
    .from("review_submissions")
    .select(`
      *,
      profiles(full_name),
      review_assignments!inner(paper_id)
    `)
    .eq("review_assignments.paper_id", params.id)
    .eq("status", "completed");

  // Combine and deduplicate reviews
  const allReviews = [
    ...(reviewsBySubmission || []),
    ...(reviewsByAssignment1 || []),
    ...(reviewsByAssignment2 || [])
  ];
  const reviews = allReviews.filter((review, index, arr) => 
    arr.findIndex(r => r.id === review.id) === index
  );

  const isAuthor = user?.id === submission.submitter_id;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {searchParams.payment === "success" && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400 rounded-lg">
          Payment successful! Your paper is now under review.
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{submission.title}</h1>
        <div className="flex items-center gap-4 mb-4">
          <p className="text-muted-foreground">by {submission.profiles?.full_name}</p>
          <Badge className={
            submission.status === "finalized" ? "bg-green-100 text-green-800" :
            submission.status === "under-review" ? "bg-blue-100 text-blue-800" :
            "bg-yellow-100 text-yellow-800"
          }>
            {submission.status}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6" suppressHydrationWarning>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({reviews?.length || 0})</TabsTrigger>
          {submission.pdf_url && <TabsTrigger value="pdf">PDF</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Abstract</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{submission.abstract}</p>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Keywords</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {submission.keywords?.map((kw: string) => (
                  <Badge key={kw} variant="secondary">{kw}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm font-medium mb-2">Paper PDF</p>
                <Button asChild variant="outline" size="sm">
                  <a href={submission.pdf_url} target="_blank" rel="noopener noreferrer">
                    Download PDF
                  </a>
                </Button>
              </div>
              {submission.code_url && (
                <div>
                  <p className="text-sm font-medium mb-2">Code Archive</p>
                  <Button asChild variant="outline" size="sm">
                    <a href={submission.code_url} target="_blank" rel="noopener noreferrer">
                      Download Code
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <div className="space-y-4">
            {reviews && reviews.length > 0 ? (
              reviews.map((review: any) => (
                <Card key={review.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{review.profiles?.full_name}</CardTitle>
                    <CardDescription>
                      {new Date(review.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Novelty</p>
                        <p className="text-lg font-semibold">{review.novelty_score}/5</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Technical</p>
                        <p className="text-lg font-semibold">{review.technical_correctness_score}/5</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Clarity</p>
                        <p className="text-lg font-semibold">{review.clarity_score}/5</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Significance</p>
                        <p className="text-lg font-semibold">{review.significance_score}/5</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Recommendation</p>
                      <Badge>{review.recommendation}</Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Comments</p>
                      <p className="text-sm whitespace-pre-wrap">{review.comments}</p>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-muted-foreground">No reviews yet</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
      <div className="mt-8 flex justify-center">
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
      {/* Show claim/review actions for eligible reviewers */}
      {!isAuthor && user?.id && (
        <div className="mt-8 flex justify-center">
          <PaperReviewActions
            paperId={submission.paper_id}
            reviewerId={user.id}
          />
        </div>
      )}
    </main>
  );
}
