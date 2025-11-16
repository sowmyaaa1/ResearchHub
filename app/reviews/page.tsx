import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function ReviewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: pendingAssignments } = await supabase
    .from("review_assignments")
    .select("*, papers(title, abstract, author_id)")
    .eq("reviewer_id", user?.id)
    .eq("status", "pending")
    .order("due_date", { ascending: true });

  const { data: completedReviews } = await supabase
    .from("reviews")
    .select("*, papers(title, abstract)")
    .eq("reviewer_id", user?.id)
    .order("created_at", { ascending: false });

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Peer Review</h1>
            <p className="text-muted-foreground">
              Review papers and provide feedback to the research community
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">
              Pending Reviews ({pendingAssignments?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedReviews?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {(!pendingAssignments || pendingAssignments.length === 0) ? (
              <Card className="p-8 text-center text-muted-foreground">
                <p>No pending reviews at this time</p>
              </Card>
            ) : (
              pendingAssignments.map((assignment: any) => (
                <Card key={assignment.id} className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {assignment.papers?.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {assignment.papers?.abstract}
                      </p>
                    </div>

                    {assignment.due_date && (
                      <p className="text-sm text-muted-foreground">
                        Due: {new Date(assignment.due_date).toLocaleDateString()}
                      </p>
                    )}

                    <Button asChild>
                      <Link href={`/reviews/${assignment.id}`}>
                        Start Review
                      </Link>
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {(!completedReviews || completedReviews.length === 0) ? (
              <Card className="p-8 text-center text-muted-foreground">
                <p>You haven&apos;t completed any reviews yet</p>
              </Card>
            ) : (
              completedReviews.map((review: any) => (
                <Card key={review.id} className="p-6">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {review.papers?.title}
                    </h3>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex gap-1">
                        {[...Array(review.rating)].map((_, i) => (
                          <span key={i} className="text-yellow-500">★</span>
                        ))}
                      </div>
                      <span className="px-2 py-1 rounded text-xs bg-primary/10 text-primary">
                        {review.recommendation}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
